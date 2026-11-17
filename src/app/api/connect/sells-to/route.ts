import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";

// Saves whether the account sells to businesses, consumers or both. Read by the setup steps, the
// Data tab and the assistant, so the wording and the questions asked match the company.
export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const sellsTo = body?.sellsTo;
  if (sellsTo !== "business" && sellsTo !== "consumer" && sellsTo !== "both") {
    return NextResponse.json({ error: "sellsTo must be business, consumer or both." }, { status: 400 });
  }
  const { error } = await auth.supabase.from("accounts").update({ sells_to: sellsTo }).eq("id", auth.accountId);
  if (error) return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  return NextResponse.json({ ok: true, sellsTo });
}
