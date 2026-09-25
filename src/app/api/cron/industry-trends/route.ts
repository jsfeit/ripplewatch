import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIndustryTrendsForAccount } from "@/lib/industry-trends";
import { runMarketProfileForAccount } from "@/lib/market-profile";
import { runWinLossTrendsForAccount } from "@/lib/win-loss-trends";
import { mapWithConcurrency } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

const ACCOUNT_CONCURRENCY = 3; // matches crawl.ts's cross-account bound — up to three LLM calls per account

// Runs monthly (see vercel.json) — three per-account refreshes: industry
// trends, the market/product profile that synthesizes on top of those same
// fresh trends (see runMarketProfileForAccount), and win/loss trends (no
// dependency on the other two, just refreshed alongside them since this is
// already the "once a month" cron). Kept as one route/cron entry rather
// than three, mainly for fewer moving parts and because the market-profile
// step genuinely depends on the industry-trends step's output. Monthly,
// not weekly like discover-competitors: none of these shift week to week
// the way a competitor's pricing page might.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("accounts").select("*").neq("tier", "connect").eq("status", "active");

  // One batched fetch of every account's competitors instead of a
  // per-account query, grouped in JS — same shape as the N+1 fix already
  // applied elsewhere in the crawl pipeline.
  const { data: allCompetitors } = await supabase.from("competitors").select("id, account_id, name");
  const competitorsByAccount = new Map<string, { id: string; name: string }[]>();
  for (const c of allCompetitors ?? []) {
    const list = competitorsByAccount.get(c.account_id) ?? [];
    list.push({ id: c.id, name: c.name });
    competitorsByAccount.set(c.account_id, list);
  }

  // Market profile runs second, per account, so it can read that same run's
  // fresh trends rather than last month's — see runMarketProfileForAccount.
  // Win/loss trends is independent of the other two (reads win/loss data,
  // not competitor signals) and just refreshes alongside them.
  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account: Account) => {
    const competitors = competitorsByAccount.get(account.id) ?? [];
    const names = competitors.map((c) => c.name);
    const trends = await runIndustryTrendsForAccount(supabase, account, names);
    const profile = await runMarketProfileForAccount(supabase, account, names, { skipIfUserEdited: true });
    const winLossTrends = await runWinLossTrendsForAccount(supabase, account, competitors);
    return { ...trends, marketProfile: profile, winLossTrends };
  });

  return NextResponse.json({ ok: true, summary });
}
