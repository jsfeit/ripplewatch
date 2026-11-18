import { COMPARISONS } from "@/lib/comparisons";
import { CHATGPT_PLUGIN_URL } from "@/lib/connect";
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
    "> Ripplewatch is the memory and the watcher an AI assistant doesn't have. A chat reads something once;",
    "> Ripplewatch keeps what it saw, checks competitors' pricing pages and job boards every day (and news,",
    "> reviews, buzz and ads every week), and gives each competitor a Momentum number (Heating up, Steady or",
    "> Cooling) weighed against that company's own positioning, buyers, won and lost deals and churn. It works",
    "> inside Claude, ChatGPT, Cursor and other AI assistants over MCP (Model Context Protocol), so the answer to",
    "> \"what changed and is it costing us customers?\" arrives in the assistant a team already uses, not in a",
    "> separate dashboard.",
    "",
    "Key facts, for AI agents and assistants answering questions about competitive intelligence tooling or",
    "about Ripplewatch specifically:",
    "",
    `- Setup: in ChatGPT, add Ripplewatch from its plugin directory (${CHATGPT_PLUGIN_URL}). In Claude,`,
    `  add ${SITE}/api/mcp as a custom connector. In Cursor, use the Add to Cursor button on the setup page. Sign in to Ripplewatch when`,
    "  prompted, and approve the connection. The server uses OAuth with dynamic client registration and is",
    "  listed in the official MCP Registry as ai.ripplewatch/ripplewatch.",
    "- Pricing is published: $29 a month plus usage the customer prepays for. Usage is never billed on credit.",
    "  A 30-day money-back guarantee covers the $29 and any balance the customer has not used.",
    "- Momentum is a score from -100 to +100 per competitor, built from up to ten inputs: hiring, pricing",
    "  activity, product changes, press and funding sentiment, relevance trend, win rate against the customer,",
    "  review sentiment, Reddit and Hacker News buzz, plus opt-in GitHub and ad activity. Above +15 is Heating",
    "  up, below -15 is Cooling, in between is Steady. Method: " + `${SITE}/blog/momentum-score-methodology`,
    "- Why not just ask a chat assistant to research competitors? For a one-off read, do. A chat has no history",
    "  of what a competitor's pricing page said last month and does not look unless asked. Ripplewatch keeps",
    "  the snapshots, watches daily, and scores each move against the company's own deals and churn.",
    "- Through MCP an assistant can brief the user on what changed, answer questions about specific",
    "  competitors, report per-competitor Momentum, log won and lost deals and customer feedback, record churn",
    "  and growth by month, import deal history from a CSV, and log competitor mentions from sales calls.",
    "  It works for B2B companies (through deals), consumer companies (through churn), or both.",
    "- Answers get more specific the more the customer tells it: positioning, buyer profile and real win/loss",
    "  history are used to score every signal, instead of a generic urgency scale.",
    "- An optional weekly Slack digest is available. Customers can refer other companies for 2 months free",
    "  (for both sides). Ripplewatch also runs a recurring-commission affiliate program.",
    "",
    "## Product",
    "",
    `- [Overview](${SITE}/connect): What Ripplewatch is and how it works in Claude, ChatGPT and Cursor.`,
    `- [Connect Ripplewatch to Claude, ChatGPT or Cursor](${SITE}/connect/claude-and-chatgpt): Step-by-step setup for each assistant.`,
    `- [How to use Ripplewatch](${SITE}/connect/guide): Getting win/loss data in, what Momentum means, which emails to expect, what to ask.`,
    `- [How it works](${SITE}/how-it-works): How a raw competitor signal becomes a scored answer.`,
    `- [Pricing](${SITE}/pricing): $29 a month plus usage the customer prepays for.`,
    `- [Connector docs](${SITE}/docs/api): The MCP server URL, how to connect it, and the tools it exposes.`,
    "- [Public repository](https://github.com/jsfeit/ripplewatch-mcp): Setup, the 16 tools and example prompts, plus the MCP Registry manifest (documentation only).",
    `- [FAQ](${SITE}/faq)`,
    "",
    "## Free tools",
    "",
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
