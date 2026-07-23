import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDigestEmail, type DigestSignal } from "@/lib/resend";
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
      .is("email_digest_sent_at", null);

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

    await sendDigestEmail(account.contact_email, account.name, digestSignals, "daily");
    await supabase
      .from("signals")
      .update({ email_digest_sent_at: new Date().toISOString() })
      .in("id", pending.map((s) => s.id));

    summary.push({ account: account.name, sent: pending.length });
  }

  return NextResponse.json({ ok: true, summary });
}
