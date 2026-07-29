import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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

  if (searchParams.get("debug") === "1") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: "You research a named competitor using web search and report back news.",
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: `Research "${competitor}" for recent news.` }],
    });
    return NextResponse.json({
      stop_reason: message.stop_reason,
      block_types: message.content.map((b) => b.type),
      content: message.content,
    });
  }

  const headlines = await searchCompetitorNews(competitor);
  return NextResponse.json({ competitor, headlines });
}
