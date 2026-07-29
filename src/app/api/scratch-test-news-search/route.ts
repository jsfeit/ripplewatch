import { NextResponse } from "next/server";
import { searchCompetitorNews } from "@/lib/anthropic";

// TEMPORARY — one-off verification of searchCompetitorNews() against the
// real API before it's ever wired into anything live. Removed right after
// confirming it works; the token below is single-use and this file's
// lifetime is measured in minutes.
const SCRATCH_TOKEN = "74964b1de116163e17600fb0e73e1b1c743fe696cbe01033";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== SCRATCH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competitor = searchParams.get("competitor") ?? "Xero";
  const headlines = await searchCompetitorNews(competitor);
  return NextResponse.json({ competitor, headlines });
}
