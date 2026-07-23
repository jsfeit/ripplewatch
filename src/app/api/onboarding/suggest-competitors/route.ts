import { NextResponse } from "next/server";
import { suggestCompetitors } from "@/lib/anthropic";

// Deliberately open to anonymous visitors — this runs during the onboarding
// demo, before an account exists and often before anyone has signed in at
// all. It's read-only against Claude, not account-scoped, so there's
// nothing here that needs an authenticated user.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
  const positioning = typeof body?.positioning === "string" ? body.positioning.trim() : null;
  const icp = typeof body?.icp === "string" ? body.icp.trim() : null;

  if (!companyName) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  try {
    const competitors = await suggestCompetitors(companyName, positioning, icp);
    return NextResponse.json({ competitors });
  } catch (err) {
    console.error("competitor suggestion failed:", err);
    // Not fatal — onboarding proceeds fine with manual entry only.
    return NextResponse.json({ competitors: [] });
  }
}
