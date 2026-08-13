// Blog content — a typed array rather than MDX/a CMS, matching how
// comparisons.ts and tiers.ts already model structured marketing content
// in this codebase. Each post's body is a list of typed blocks (heading,
// paragraph, list) instead of markdown, so rendering stays a plain,
// type-checked switch in the post page rather than a parsing pipeline.
//
// Starts empty on purpose — this file is the scaffold, not the content.
// Add entries here once topics are picked; the index page, sitemap, and
// generateStaticParams all read from this array automatically.

export type PostBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export type PostEntry = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date, e.g. "2026-08-12"
  body: PostBlock[];
};

export const POSTS: PostEntry[] = [
  {
    slug: "momentum-score-methodology",
    title: "How we score competitor momentum (and why it excludes SEO data)",
    description:
      "The math behind Ripplewatch's Momentum score: four signal types rolled into one directional number, and why we deliberately leave a fifth one out for now.",
    publishedAt: "2026-08-12",
    body: [
      {
        type: "p",
        text:
          "Every competitor page in Ripplewatch shows a Momentum badge — Heating up, Steady, Cooling, or Not enough history yet. It's meant to answer one question at a glance: is this competitor accelerating or slowing down right now? Here's exactly how it's computed.",
      },
      { type: "h2", text: "Four inputs, one 30-day window" },
      {
        type: "p",
        text:
          "Momentum compares two adjacent 30-day windows — the last 30 days versus the 30 before that — across four signal types Ripplewatch already tracks:",
      },
      {
        type: "ul",
        items: [
          "Hiring — job posting volume",
          "Pricing activity — pricing page changes",
          "Press & funding — news and funding events",
          "Relevance trend — how the average relevance score of scored signals is moving",
        ],
      },
      {
        type: "p",
        text:
          "Each component is converted into a bounded, symmetric index from -100 to +100: zero means no change between windows, and the score approaches ±100 as activity swings entirely into one window or the other. A small smoothing constant keeps a single new signal (one this month, zero last month) from immediately maxing out the score the way a raw percentage-change calculation would.",
      },
      { type: "h2", text: "Why SEO/traffic isn't in the mix yet" },
      {
        type: "p",
        text:
          "We track a fifth signal type — SEO/traffic activity — but it's currently a stubbed data source and only available on Plus and Advanced plans. Folding a stub into Momentum would make the score meaningless for Starter accounts and simply wrong for everyone else until real traffic data is wired in. So Momentum only averages the components that actually have data for a given competitor, and a competitor with zero signals in both windows across all four components shows \"Not enough history yet\" instead of a misleading zero.",
      },
      { type: "h2", text: "The thresholds" },
      {
        type: "p",
        text:
          "The final score is the average of whichever components have data. Above +15, we label it Heating up. Below -15, Cooling. Everything in between is Steady. Those thresholds are intentionally conservative — a single noisy week of hiring shouldn't flip a competitor's label back and forth.",
      },
      {
        type: "p",
        text:
          "This is also why Momentum shows up in two places — the Trends dashboard and the Competitors list badge — pulling from the exact same calculation, so the two views never drift into disagreeing about the same competitor.",
      },
    ],
  },
  {
    slug: "win-loss-reason-consolidation",
    title: "Why we stopped showing raw win/loss dumps",
    description:
      "A CSV import with 800+ win/loss rows is data. Nobody can read it. Here's how we turned it into a two-column, top-5 summary — deterministically, with no LLM call.",
    publishedAt: "2026-08-12",
    body: [
      {
        type: "p",
        text:
          "Import a CRM's win/loss export into Ripplewatch and you can easily end up with hundreds of rows — one per deal, each with a canned reason your reps picked from a CRM dropdown: \"Price\", \"Missing feature\", \"Lost to incumbent\", and a handful of variations. The raw list is complete, but nobody actually reads 800 rows to find a pattern.",
      },
      { type: "h2", text: "Group by exact text, not by meaning" },
      {
        type: "p",
        text:
          "The obvious fix is to summarize the reasons — and the obvious tool for summarizing freeform text is an LLM. We didn't use one here, on purpose. CRM win/loss reasons are close-ended in practice: they come from a fixed dropdown, so \"Price\" and \"price\" and \" Price \" are the same reason typed slightly differently, not three genuinely different reasons that need semantic clustering. Grouping by exact text (trimmed, case-insensitive) does the job, and it's deterministic and free — no API call, no risk of an LLM inventing a category that isn't in the data.",
      },
      {
        type: "p",
        text:
          "That's a real distinction we draw elsewhere in the product too: Trends, which looks for patterns across genuinely freeform text like call notes, does use the model. Win/loss reasons don't need it.",
      },
      { type: "h2", text: "Top 5, not all of them" },
      {
        type: "p",
        text:
          "Once reasons are grouped and tallied, we rank win reasons and loss reasons independently — a reason can legitimately show up on both sides, if it's mostly why you win but has cost you a couple of deals too — and cap each column at the top 5, with a \"+N more\" indicator and a thin proportional bar per row. The full raw list is still there, one click away behind a \"Show all N individual entries\" toggle, for anyone who wants to audit the underlying data.",
      },
      { type: "h2", text: "One component, two places" },
      {
        type: "p",
        text:
          "This view is the same component in two spots: on each competitor's fact sheet (scoped to deals against that one competitor) and on an account-wide Win/Loss page (aggregated across all of them). Same grouping logic, same layout, same 5-item cap — so switching between \"how do we do against Competitor X\" and \"how do we do overall\" doesn't mean learning a different UI.",
      },
    ],
  },
  {
    slug: "why-some-pricing-pages-cant-be-scraped",
    title: "Why some competitor pricing pages can't be scraped — and how to tell which",
    description:
      "Not all scraping blocks are the same. A field diagnosis of Cloudflare JS challenges, Cloudflare WAF blocks, Akamai, and one false alarm.",
    publishedAt: "2026-08-12",
    body: [
      {
        type: "p",
        text:
          "Ripplewatch tracks competitor pricing pages automatically, and every so often one comes back \"Couldn't load.\" The instinctive next step is to assume it's a bot-detection problem and reach for a bigger hammer — rotate IPs, spoof a browser fingerprint, solve the CAPTCHA. We don't do that. Those techniques cross from \"scraping resiliently\" into evading a site's explicit access controls, which isn't something we're willing to build, regardless of how easy it would make our own product.",
      },
      {
        type: "p",
        text:
          "What we do instead is diagnose the actual block before deciding whether there's a legitimate fix. Requesting a page with our own identified bot user agent (RipplewatchBot, with a link back to us — not spoofed as a browser) and reading the response headers and body tells you which of a few very different things is actually happening.",
      },
      { type: "h2", text: "Four outcomes, one curl request" },
      {
        type: "ul",
        items: [
          "Cloudflare JS challenge — an interstitial \"Just a moment...\" page with a cf-ray header. This is solvable legitimately: a headless browser that executes JavaScript (not a fingerprint-spoofing one) clears it the same way a real visitor's browser does.",
          "Cloudflare WAF hard block — an explicit \"Attention Required!\" page. This is the site operator deciding automated traffic isn't welcome at all, full stop. We treat that as a boundary, not an obstacle.",
          "Akamai hard block — \"Access Denied\" with an x-akamai-cache-status header. Similar story to a Cloudflare WAF block: a deliberate access decision, not a technical hurdle to route around.",
          "False positive — the page actually returns a clean 200. In one case, a pricing page we'd flagged as blocked turned out to be a stale status from a transient failure, not a real block at all. Worth checking before assuming the worst.",
        ],
      },
      { type: "h2", text: "The honest takeaway" },
      {
        type: "p",
        text:
          "Roughly half of scraping failures we've diagnosed this way are fixable with better tooling (a real headless browser instead of a plain HTTP request). The other half are a site operator's explicit choice, and no amount of engineering effort should override that. Distinguishing the two before writing code saves you from building something that either doesn't work or shouldn't exist.",
      },
    ],
  },
];

export function getPost(slug: string): PostEntry | undefined {
  return POSTS.find((p) => p.slug === slug);
}

// Newest first — publishedAt is a plain ISO date string, safe to compare
// lexicographically without parsing.
export function sortedPosts(): PostEntry[] {
  return [...POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}
