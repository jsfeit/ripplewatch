import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { checkRateLimit } from "@/lib/rate-limit";
import { analyzeMetrics } from "@/lib/customer-metrics";
import { extractMetricPeriods } from "@/lib/customer-metrics-llm";

// Reads pasted or uploaded churn and growth numbers in any layout and shows the read, without
// saving, so the customer can check how it was understood first.
export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;

  if (!checkRateLimit(`metrics-preview:${auth.accountId}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 8) return NextResponse.json({ error: "Paste your churn numbers first." }, { status: 400 });

  const periods = await extractMetricPeriods(text, auth.accountId);
  if (periods.length === 0) {
    return NextResponse.json(
      { error: "I couldn't find months with churn or customer numbers in that. Include a month and either the churn rate or the customers who cancelled." },
      { status: 422 }
    );
  }
  return NextResponse.json({ periods, read: analyzeMetrics(periods) });
}
