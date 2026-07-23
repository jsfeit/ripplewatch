import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestCompetitors } from "@/lib/anthropic";

// Signed-in-only rather than account-scoped — this runs during onboarding,
// before an account exists, same as the document-upload routes.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

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
