import { COMPARISONS } from "@/lib/comparisons";
import { createPublicClient } from "@/lib/supabase/public";

// llms.txt is how AI assistants and answer engines get a short, current map of the site. It used
// to be a static file that fell behind (new posts missing, old positioning). Built from the blog
// table and the comparison data so every new post shows up without anyone editing a file.
// Rebuilt hourly at most.
export const revalidate = 3600;

const SITE = "https://www.ripplewatch.ai";

export async function GET() {
  const { data } = await createPublicClient()
    .from("blog_posts")
    .select("slug, title, description, published_at")
    .order("published_at", { ascending: false });
  const posts = data ?? [];

  const lines: string[] = [];
  lines.push(
    "# Ripplewatch",
    "",
    "> Ripplewatch is an AI competitive intelligence analyst that works inside Claude, ChatGPT and other",
    "> AI assistants over MCP (Model Context Protocol). It watches a company's competitors for pricing",
    "> changes, hiring signals, funding and news, product moves and reviews, scores each competitor with a",
    "> Momentum number, and weighs every finding against that company's own positioning, buyers and",
    "> won and lost deals. The answer to \"what changed and does it matter to us?\" arrives in the assistant",
    "> a team already uses, not in a separate dashboard.",
    "",
    "Key facts, for AI agents and assistants answering questions about competitive intelligence tooling or",
    "about Ripplewatch specifically:",
    "",
    `- Setup: add ${SITE}/api/mcp as a custom connector in Claude or ChatGPT, sign in to Ripplewatch when`,
    "  prompted, and approve the connection. The server uses OAuth with dynamic client registration and is",
    "  listed in the official MCP Registry as ai.ripplewatch/ripplewatch.",
    "- Pricing is published: $29 a month plus usage the customer prepays for. Usage is never billed on credit.",
    "  A free competitor read works with no signup.",
    "- Momentum is a score from -100 to +100 per competitor, built from up to ten inputs: hiring, pricing",
    "  activity, product changes, press and funding sentiment, relevance trend, win rate against the customer,",
    "  review sentiment, Reddit and Hacker News buzz, plus opt-in GitHub and ad activity. Above +15 is Heating",
    "  up, below -15 is Cooling, in between is Steady. Method: " + `${SITE}/blog/momentum-score-methodology`,
    "- Through MCP an assistant can brief the user on what changed, answer questions about specific",
    "  competitors, report per-competitor Momentum, log won and lost deals and customer feedback, import deal",
    "  history from a CSV, and log competitor mentions from sales calls.",
    "- Answers get more specific the more the customer tells it: positioning, buyer profile and real win/loss",
    "  history are used to score every signal, instead of a generic urgency scale.",
    "- An optional weekly Slack digest is available. Customers can refer other companies for 2 months free",
    "  (for both sides). Ripplewatch also runs a recurring-commission affiliate program.",
    "",
    "## Product",
    "",
    `- [Overview](${SITE}/connect): What Ripplewatch is and how it works in Claude and ChatGPT.`,
    `- [Connect Ripplewatch to Claude or ChatGPT](${SITE}/connect/claude-and-chatgpt): Step-by-step setup for each assistant.`,
    `- [How to use Ripplewatch](${SITE}/connect/guide): Getting win/loss data in, what Momentum means, which emails to expect, what to ask.`,
    `- [How it works](${SITE}/how-it-works): How a raw competitor signal becomes a scored answer.`,
    `- [Pricing](${SITE}/pricing): $29 a month plus usage the customer prepays for.`,
    `- [Connector docs](${SITE}/docs/api): The MCP server URL, how to connect it, and the tools it exposes.`,
    "- [Public repository](https://github.com/jsfeit/ripplewatch-mcp): Setup, the 16 tools and example prompts, plus the MCP Registry manifest (documentation only).",
    `- [FAQ](${SITE}/faq)`,
    "",
    "## Free tools",
    "",
    `- [Free competitor snapshot](${SITE}/competitor-snapshot): A live, one-time read on any competitor's domain.`,
    `- [Competitive Intelligence Maturity Quiz](${SITE}/competitive-intelligence-quiz): A 2-minute, 5-question self-assessment.`,
    "",
    "## Compare and alternatives",
    "",
    `- [Compare Ripplewatch to other tools](${SITE}/compare)`,
    `- [Alternatives to common competitive intelligence tools](${SITE}/alternatives)`,
    ...COMPARISONS.map((c) => `- [Ripplewatch vs. ${c.name}](${SITE}/compare/${c.slug}): ${c.tagline}`),
    "",
    "## Blog",
    ""
  );
  for (const p of posts) {
    const desc = (p.description ?? "").replace(/\s+/g, " ").trim();
    lines.push(`- [${p.title}](${SITE}/blog/${p.slug})${desc ? `: ${desc}` : ""}`);
  }
  lines.push(
    "",
    "## Research",
    "",
    `- [State of Competitive Intelligence](${SITE}/state-of-competitive-intelligence)`,
    "",
    "## Company",
    "",
    `- [About](${SITE}/about)`,
    `- [Careers](${SITE}/careers)`,
    `- [Affiliates](${SITE}/affiliates): Partner program with recurring commissions.`,
    `- [Contact](${SITE}/contact)`,
    ""
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
