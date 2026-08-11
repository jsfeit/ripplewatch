import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDigestEmail, type DigestSignal } from "@/lib/resend";
import { generateDigestVerdict, type VerdictSignal } from "@/lib/anthropic";
import type { Database } from "@/lib/supabase/types";

type Signal = Database["public"]["Tables"]["signals"]["Row"];

// Runs once a day, after the crawl cron. Covers High and Medium relevance
// signals: High already went out in real time over Slack (see
// /api/cron/crawl), but still belongs here as the email record for anyone
// who isn't on Slack. Medium has no real-time channel at all — this is the
// first time it's delivered anywhere. Low relevance and unscored signals are
// deliberately excluded — they're noisy enough that they wait for the
// weekly rollup (/api/cron/digest-weekly) instead.
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
      .in("relevance_level", ["High", "Medium"])
      .is("email_digest_sent_at", null)
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
      scored: true,
      relevanceLevel: s.relevance_level,
      relevanceReasoning: s.relevance_reasoning,
    }));

    // One synthesis call per account per day, only when there's actually a
    // batch to synthesize (the pending.length === 0 branch above already
    // returns before this point) — bounded the same way the per-signal
    // scoring call already is.
    let verdict: string | null = null;
    try {
      const verdictSignals: VerdictSignal[] = pending.map((s) => ({
        competitorName: competitors?.find((c) => c.id === s.competitor_id)?.name ?? "Unknown",
        title: s.title,
        relevanceLevel: s.relevance_level ?? "Medium",
        relevanceReasoning: s.relevance_reasoning,
      }));
      verdict = await generateDigestVerdict(
        {
          companyName: account.name,
          positioning: account.positioning,
          icp: account.icp,
          lostDealNotes: account.lost_deal_notes,
          churnNotes: account.churn_notes,
          companyResearch: account.company_research,
        },
        verdictSignals,
        account.id
      );
    } catch (err) {
      // A missing verdict just means the email reads as a plain list
      // today, same as before this feature existed — not worth failing
      // the whole digest send over.
      console.error(`daily verdict generation failed for ${account.name}:`, err);
    }

    try {
      await sendDigestEmail(account.contact_email, account.name, digestSignals, "daily", verdict);
    } catch (err) {
      // Don't mark these as sent — leave them pending so the next run
      // retries, and don't let one account's failure stop the rest.
      console.error(`daily digest send failed for ${account.name}:`, err);
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
