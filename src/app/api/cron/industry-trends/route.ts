import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIndustryTrendsForAccount } from "@/lib/industry-trends";
import { runMarketProfileForAccount } from "@/lib/market-profile";
import { mapWithConcurrency } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

const ACCOUNT_CONCURRENCY = 3; // matches crawl.ts's cross-account bound — two web-search-grounded LLM calls per account

// Runs monthly (see vercel.json) — two web-search-grounded calls per
// account: industry trends, then the market/product profile that
// synthesizes on top of those same fresh trends (see
// runMarketProfileForAccount). Kept as one route/cron entry rather than two
// because the second genuinely depends on the first's output, not just for
// fewer moving parts. Monthly, not weekly like discover-competitors:
// category-level trends don't shift week to week the way a competitor's
// pricing page might.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("accounts").select("*").eq("status", "active");

  // One batched fetch of every account's competitors instead of a
  // per-account query, grouped in JS — same shape as the N+1 fix already
  // applied elsewhere in the crawl pipeline.
  const { data: allCompetitors } = await supabase.from("competitors").select("account_id, name");
  const namesByAccount = new Map<string, string[]>();
  for (const c of allCompetitors ?? []) {
    const list = namesByAccount.get(c.account_id) ?? [];
    list.push(c.name);
    namesByAccount.set(c.account_id, list);
  }

  // Market profile runs second, per account, so it can read that same run's
  // fresh trends rather than last month's — see runMarketProfileForAccount.
  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, async (account: Account) => {
    const names = namesByAccount.get(account.id) ?? [];
    const trends = await runIndustryTrendsForAccount(supabase, account, names);
    const profile = await runMarketProfileForAccount(supabase, account, names, { skipIfUserEdited: true });
    return { ...trends, marketProfile: profile };
  });

  return NextResponse.json({ ok: true, summary });
}
