import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDigestEmail, type DigestSignal } from "@/lib/resend";
import type { Database } from "@/lib/supabase/types";

type Signal = Database["public"]["Tables"]["signals"]["Row"];

// Runs once a week. Catches everything the daily digest deliberately skips:
// Low relevance signals and raw (unscored) signals — real, but not urgent
// enough to justify a same-day interruption. Rolling these into a weekly
// email instead of a daily one is the whole point of tiering delivery by
// relevance in the first place; without it, every account still gets a
// daily flood, just relabeled.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("accounts").select("*").not("contact_email", "is", null);

  const summary: Record<string, unknown>[] = [];

  for (const account of accounts ?? []) {
    if (!account.contact_email) continue;

    const { data: competitors } = await supabase
      .from("competitors")
      .select("id, name")
      .eq("account_id", account.id);
    const competitorIds = (competitors ?? []).map((c) => c.id);
    if (competitorIds.length === 0) continue;

    const { data: signals } = await supabase
      .from("signals")
      .select("*")
      .in("competitor_id", competitorIds)
      .is("email_digest_sent_at", null)
      .or("relevance_level.eq.Low,scored.eq.false")
      // Backfill (a competitor's first-ever crawl, seeding landscape context
      // for a new account) is deliberately excluded from digests too — this
      // email is "what happened recently," not "here's the history."
      .neq("source", "backfill");

    const pending = (signals ?? []) as Signal[];
    if (pending.length === 0) {
      summary.push({ account: account.name, sent: 0 });
      continue;
    }

    const digestSignals: DigestSignal[] = pending.map((s) => ({
      competitorName: competitors?.find((c) => c.id === s.competitor_id)?.name ?? "Unknown",
      title: s.title,
      scored: s.scored,
      relevanceLevel: s.relevance_level,
      relevanceReasoning: s.relevance_reasoning,
    }));

    try {
      await sendDigestEmail(account.contact_email, account.name, digestSignals, "weekly");
    } catch (err) {
      console.error(`weekly digest send failed for ${account.name}:`, err);
      summary.push({ account: account.name, sent: 0, error: true });
      continue;
    }

    await supabase
      .from("signals")
      .update({ email_digest_sent_at: new Date().toISOString() })
      .in("id", pending.map((s) => s.id));

    summary.push({ account: account.name, sent: pending.length });
  }

  return NextResponse.json({ ok: true, summary });
}
