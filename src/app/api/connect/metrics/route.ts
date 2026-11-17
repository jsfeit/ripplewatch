import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadChurnInsight } from "@/lib/churn-insight";
import { cleanPeriods } from "@/lib/customer-metrics-llm";

function segmentFrom(value: unknown): "business" | "consumer" {
  return value === "business" ? "business" : "consumer";
}

// Saved churn and growth for the account, with the read of it, whether churn started rising near a
// competitor's move, and how it sits against a published range. Asking also quietly refreshes the
// benchmark when there is none yet.
export async function GET(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;
  const segment = segmentFrom(new URL(request.url).searchParams.get("segment"));
  const insight = await loadChurnInsight(createAdminClient(), auth.accountId, segment, { refreshBenchmark: true });
  return NextResponse.json(insight);
}

// Saves months of churn and growth. A month already saved for that side is updated, not duplicated.
export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const periods = cleanPeriods(body?.periods);
  if (periods.length === 0) return NextResponse.json({ error: "No usable months to save." }, { status: 400 });
  const segment = segmentFrom(body?.segment);

  const { error } = await auth.supabase.from("customer_metrics").upsert(
    periods.map((p) => ({
      account_id: auth.accountId,
      segment,
      period_start: p.periodStart,
      customers_start: p.customersStart,
      new_customers: p.newCustomers,
      cancelled_customers: p.cancelledCustomers,
      customers_end: p.customersEnd,
      revenue: p.revenue,
      churn_pct: p.churnPct,
      source: "setup",
      created_by: auth.userId,
    })),
    { onConflict: "account_id,segment,period_start" }
  );
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  const insight = await loadChurnInsight(createAdminClient(), auth.accountId, segment, { refreshBenchmark: true });
  return NextResponse.json({ saved: periods.length, ...insight });
}
