import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIndustryTrendsForAccount } from "@/lib/industry-trends";

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

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
  const { data: accounts } = await supabase.from("accounts").select("*");

  const summary = [];
  for (const account of accounts ?? []) {
    const { data: competitors } = await supabase.from("competitors").select("name").eq("account_id", account.id);
    summary.push(await runIndustryTrendsForAccount(supabase, account, (competitors ?? []).map((c) => c.name)));
  }

  return NextResponse.json({ ok: true, summary });
}
