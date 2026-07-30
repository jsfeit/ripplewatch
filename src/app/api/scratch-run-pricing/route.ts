// TEMPORARY — one-time manual run of pricing checks for a single account,
// so its just-backfilled pricing_url values don't have to wait for the
// next scheduled daily crawl. Deleted immediately after use.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPricingDiff, checkPricingStructure } from "@/lib/scraping";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SCRATCH_PRICING_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = new URL(request.url).searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: competitors, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", accountId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const competitor of competitors ?? []) {
    try {
      const diffSignal = await checkPricingDiff(supabase, competitor);
      await checkPricingStructure(supabase, competitor);
      results.push({ competitor: competitor.name, ok: true, diffSignal: diffSignal?.title ?? null });
    } catch (err) {
      results.push({ competitor: competitor.name, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}
