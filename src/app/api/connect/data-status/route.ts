import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadChurnInsight } from "@/lib/churn-insight";

// What Ripplewatch has been given so far, for the setup step that hands data entry to the customer's
// assistant: it polls this so it can say "Got it" the moment the assistant saves something.
export async function GET() {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();

  const countOutcome = async (outcome: "won" | "lost" | "churned") => {
    const { count } = await admin
      .from("competitor_win_loss")
      .select("id", { count: "exact", head: true })
      .eq("account_id", auth.accountId)
      .eq("outcome", outcome);
    return count ?? 0;
  };

  const [insight, won, lost, churned] = await Promise.all([
    loadChurnInsight(admin, auth.accountId, "consumer"),
    countOutcome("won"),
    countOutcome("lost"),
    countOutcome("churned"),
  ]);

  return NextResponse.json({
    churn: { months: insight.periods.length, headline: insight.read?.headline ?? null, trend: insight.read?.trend ?? null },
    deals: { won, lost, churned, total: won + lost + churned },
  });
}
