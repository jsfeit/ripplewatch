import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadChurnInsight } from "@/lib/churn-insight";
import { loadMomentumBoard } from "@/lib/momentum-board";

// What Ripplewatch has been given so far, for the setup step that hands data entry to the customer's
// assistant: it polls this so it can say "Got it" the moment the assistant saves something.
//
// With ?momentum=1 it also returns where each competitor stands now and whether churn started rising
// near a competitor's move, for the finish screen. That part is heavier to compute, so the frequent
// polling on the data step leaves it out.
export async function GET(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const withMomentum = new URL(request.url).searchParams.get("momentum") === "1";

  const countOutcome = async (outcome: "won" | "lost" | "churned") => {
    const { count } = await admin
      .from("competitor_win_loss")
      .select("id", { count: "exact", head: true })
      .eq("account_id", auth.accountId)
      .eq("outcome", outcome);
    return count ?? 0;
  };

  const [insight, won, lost, churned, momentum] = await Promise.all([
    loadChurnInsight(admin, auth.accountId, "consumer"),
    countOutcome("won"),
    countOutcome("lost"),
    countOutcome("churned"),
    withMomentum ? loadMomentumBoard(admin, auth.accountId) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    churn: { months: insight.periods.length, headline: insight.read?.headline ?? null, trend: insight.read?.trend ?? null },
    deals: { won, lost, churned, total: won + lost + churned },
    ...(momentum ? { momentum, timing: insight.timing?.sentence ?? null } : {}),
  });
}
