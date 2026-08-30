import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIndustryTrendsForAccount } from "@/lib/industry-trends";
import { mapWithConcurrency } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

const ACCOUNT_CONCURRENCY = 3; // matches crawl.ts's cross-account bound — one web-search-grounded LLM call per account

// Runs monthly (see vercel.json) — one web-search-grounded call per account,
// scoped to that account's own positioning/ICP rather than any single
// tracked competitor. Monthly, not weekly like discover-competitors:
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

  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, (account: Account) =>
    runIndustryTrendsForAccount(supabase, account, namesByAccount.get(account.id) ?? [])
  );

  return NextResponse.json({ ok: true, summary });
}
