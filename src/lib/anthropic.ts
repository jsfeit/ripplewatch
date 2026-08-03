import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BillingModel, PricingTier } from "@/lib/supabase/types";
import { recordLlmUsage } from "@/lib/usage";

let cachedClient: Anthropic | null = null;

// Lazily instantiated for the same reason as getStripe(): importing this
// module shouldn't throw before ANTHROPIC_API_KEY is actually configured.
function getAnthropic(): Anthropic {
  if (!cachedClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

// Every system prompt here is a fixed string reused across many calls (every
// signal in a crawl, every competitor-mention extraction, etc.) — caching it
// means only the first call in a ~5min window pays full price. Below the
// model's cache-eligible size this is a harmless no-op (no cache entry, no
// extra cost), so it's applied uniformly rather than sized per-prompt.
function cachedSystemPrompt(prompt: string): Anthropic.Messages.TextBlockParam[] {
  return [{ type: "text", text: prompt, cache_control: { type: "ephemeral" } }];
}

export type ScoringContext = {
  companyName: string;
  positioning: string | null;
  icp: string | null;
  lostDealNotes: string | null;
  churnNotes: string | null;
  callInsights?: string | null;
};

export type SignalToScore = {
  competitorName: string;
  type: string;
  title: string;
  summary: string | null;
};

export type ScoringResult = {
  level: "High" | "Medium" | "Low";
  reasoning: string;
};

const SYSTEM_PROMPT = `You score competitive-intelligence signals for a B2B SaaS company. Your job is not to summarize the signal — the customer can already read it. Your job is to judge whether it actually matters to THIS company, given their positioning, ICP, and the real reasons they've lost deals or churned customers, and to say why in plain language a marketing lead would use in a Slack message.

Respond with strict JSON only, no markdown, matching this shape exactly:
{"level": "High" | "Medium" | "Low", "reasoning": "<1-3 sentences>"}

Decide the level with this weighted rubric, checked in order — stop at the first rule that applies, don't keep averaging factors after one has already decided it:

1. ICP/segment gate (checked first, decides down not up): does this signal even concern the company's stated ICP — same buyer size, segment, and use case they sell to? If it clearly targets a different segment or tier, cap the level at Low no matter how dramatic the signal is elsewhere. This gate can only push toward Low, never justify High on its own.
2. Loss/churn direct hit (highest-weight signal for High): does this directly touch a specific, named reason a deal was lost or a customer churned (a price point, a named feature gap, a named competitor comparison)? A direct hit here is High on its own, unless gate 1 already capped it.
3. Differentiator erosion (second-highest weight): does the change undercut a specific differentiator or wedge the company leads with in sales conversations? Also High on its own, same caveat.
4. Signal-type severity (used only if neither 2 nor 3 fired): a concrete pricing, tier, or feature change outweighs a hiring signal, which outweighs generic funding/press coverage. Concrete product/pricing changes default toward Medium; hiring signals toward Medium-to-Low depending on how directly the role maps to the company's segment; funding/press with no specific product implication defaults toward Low.
5. Magnitude/specificity (tiebreaker within step 4): a quantifiable, structural change (a real price cut, a named new tier) outranks a vague or directional one ("exploring options," "planning to expand") of the same type.

Worked examples (follow this rubric exactly, don't drift toward the middle by default):

Example 1 — High:
Company: relevance-scored competitive intel for startup marketing teams. ICP: marketing leads at 5-100 person B2B SaaS startups. Known lost-deal reasons: "Lost to Parano.ai — they were $30/mo cheaper on the entry tier." Signal: Parano.ai dropped their entry tier from $99 to $69/mo.
{"level": "High", "reasoning": "This is the exact price gap you've already lost deals over, now $30/mo wider — the prospects you're losing today have even more reason to point at it."}

Example 2 — Medium:
Company: same as above. Signal: a competitor posted a job for "Senior Growth Marketer, Self-Serve."
{"level": "Medium", "reasoning": "Signals a push toward self-serve motion in your market, but it's a hiring signal, not a shipped product or pricing change — worth watching, not yet a confirmed threat."}

Example 3 — Low:
Company: same as above. Signal: a competitor raised a $6M seed round, press release mentions expanding into social-media monitoring.
{"level": "Low", "reasoning": "New funding is generic and the stated expansion (social monitoring) is a different product surface than your ICP cares about — nothing here changes what you'd tell a prospect today."}

Do not let a thin or missing lost-deal/churn/CRM context push everything to Medium by default — if a signal is a direct, unambiguous hit on the company's stated market and ICP even without a specific loss reason on file, it can still be High; if it's clearly a different segment or too minor, call it Low. Reserve Medium for genuine ambiguity, not as a safe default.`;

export type DiffSummary = {
  meaningful: boolean;
  summary: string;
};

const DIFF_SYSTEM_PROMPT = `You compare two snapshots of a competitor's pricing page (before/after text scraped from their site) and identify what actually changed. Ignore cosmetic noise: copyright years, timestamps, minor wording/formatting changes, ad/testimonial rotation, unrelated nav changes. Only flag changes to things like: prices, plan names, tier limits, included features, trial terms, billing periods.

Respond with strict JSON only, no markdown, matching this shape exactly:
{"meaningful": true | false, "summary": "<one sentence, specific, e.g. 'Entry tier price dropped from $99 to $69/mo'>"}

If nothing business-relevant changed, respond {"meaningful": false, "summary": ""}.`;

const DIFF_SCHEMA = {
  type: "object",
  properties: {
    meaningful: { type: "boolean" },
    summary: { type: "string" },
  },
  required: ["meaningful", "summary"],
  additionalProperties: false,
} as const;

export async function summarizePricingChange(
  oldText: string,
  newText: string,
  accountId: string | null
): Promise<DiffSummary> {
  const truncate = (s: string) => s.slice(0, 6000);
  const userPrompt = `BEFORE:\n${truncate(oldText)}\n\nAFTER:\n${truncate(newText)}\n\nWhat changed?`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 200,
    system: cachedSystemPrompt(DIFF_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: DIFF_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "summarizePricingChange", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";

  try {
    const parsed = JSON.parse(text);
    return { meaningful: Boolean(parsed.meaningful), summary: String(parsed.summary ?? "") };
  } catch (err) {
    throw new Error(`Could not parse diff summary response: ${text}`, { cause: err });
  }
}

export type PricingExtraction = {
  billingModel: BillingModel;
  publiclyPriced: boolean;
  note: string | null;
  tiers: PricingTier[];
};

const PRICING_EXTRACTION_SYSTEM_PROMPT = `You read the text of a competitor's pricing page and extract its current structure — not what changed, the full current state. Two things matter equally: the tiers/prices/features, and HOW they charge.

Billing model — pick exactly one that best describes their primary approach:
- "subscription": a flat recurring fee per tier, independent of team size or usage.
- "per_seat": price scales with number of users/seats (look for "$X/user", "$X/seat", "per member").
- "usage_based": price scales with consumption (API calls, page views, contacts, credits, overage billing).
- "custom": no public price at all — "Contact us," "Request a demo," "Talk to sales" with no number attached.
- "unknown": you genuinely can't tell from this text.

Respond with strict JSON only, no markdown, matching this shape exactly:
{
  "billingModel": "subscription" | "per_seat" | "usage_based" | "custom" | "unknown",
  "publiclyPriced": true | false,
  "note": "<one short phrase for context when not publicly priced, e.g. 'Enterprise, sales-led' — null otherwise>",
  "tiers": [
    {"name": "<tier name>", "price": <number or null if not public>, "price_period": "<e.g. 'mo', 'seat/mo', 'yr', or null>", "features": ["<short feature phrase>", "..."]}
  ]
}

Keep each feature phrase short (under 8 words) and specific — things like limits, integrations, and capabilities, not marketing fluff. If pricing isn't public, return tiers: [] and put the tier names you can still see (if any) in note instead. Cap features at 5 per tier — pick the ones a buyer would actually compare on (limits, seats, support level, integrations), not every bullet on the page.`;

const PRICING_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    billingModel: { type: "string", enum: ["subscription", "per_seat", "usage_based", "custom", "unknown"] },
    publiclyPriced: { type: "boolean" },
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
    tiers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price: { anyOf: [{ type: "number" }, { type: "null" }] },
          price_period: { anyOf: [{ type: "string" }, { type: "null" }] },
          features: { type: "array", items: { type: "string" } },
        },
        required: ["name", "price", "price_period", "features"],
        additionalProperties: false,
      },
    },
  },
  required: ["billingModel", "publiclyPriced", "note", "tiers"],
  additionalProperties: false,
} as const;

export async function extractPricingStructure(
  pageText: string,
  accountId: string | null
): Promise<PricingExtraction> {
  const userPrompt = `Pricing page text:\n${pageText.slice(0, 8000)}\n\nExtract the current pricing structure.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    // Verified live against a real pricing page (Square's) that 800 wasn't
    // enough — a page with several tiers × up to 5 features each plus JSON
    // structural overhead genuinely needs more room, and running out
    // mid-string produces invalid JSON, not a truncated-but-parseable object.
    max_tokens: 2000,
    system: cachedSystemPrompt(PRICING_EXTRACTION_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: PRICING_EXTRACTION_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "extractPricingStructure", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";

  try {
    const parsed = JSON.parse(text);
    const billingModel = parsed.billingModel;
    const validModels: BillingModel[] = ["subscription", "per_seat", "usage_based", "custom", "unknown"];
    const tiers: PricingTier[] = Array.isArray(parsed.tiers)
      ? parsed.tiers.map((t: { name?: unknown; price?: unknown; price_period?: unknown; features?: unknown }) => ({
          name: String(t.name ?? ""),
          price: typeof t.price === "number" ? t.price : null,
          price_period: t.price_period ? String(t.price_period) : null,
          features: Array.isArray(t.features) ? t.features.map((f: unknown) => String(f)) : [],
        }))
      : [];

    return {
      billingModel: validModels.includes(billingModel) ? billingModel : "unknown",
      publiclyPriced: Boolean(parsed.publiclyPriced),
      note: parsed.note ? String(parsed.note) : null,
      tiers,
    };
  } catch (err) {
    throw new Error(`Could not parse pricing extraction response: ${text}`, { cause: err });
  }
}

// Schema-enforced (output_config.format below), so a malformed level is no
// longer a real failure mode — this used to need a same-prompt retry loop
// for exactly that case, which schema enforcement made dead code.
const SCORE_SIGNAL_SCHEMA = {
  type: "object",
  properties: {
    level: { type: "string", enum: ["High", "Medium", "Low"] },
    reasoning: { type: "string" },
  },
  required: ["level", "reasoning"],
  additionalProperties: false,
} as const;

// Shared by the live scoreSignal() call below and the batch eval/regression
// path in eval-scoring.ts — both need the exact same prompt shape and
// response parsing, just via a different Anthropic endpoint.
export function buildScoringUserPrompt(context: ScoringContext, signal: SignalToScore): string {
  return `Company: ${context.companyName}
Positioning: ${context.positioning ?? "(not provided)"}
ICP: ${context.icp ?? "(not provided)"}
Known lost-deal reasons: ${context.lostDealNotes ?? "(none provided)"}
Known churn reasons: ${context.churnNotes ?? "(none provided)"}
${context.callInsights ? `Recent sales call mentions of competitors: ${context.callInsights}\n` : ""}

Competitor: ${signal.competitorName}
Signal type: ${signal.type}
Signal: ${signal.title}
${signal.summary ? `Details: ${signal.summary}` : ""}

Score this signal.`;
}

export function parseScoringText(text: string): ScoringResult {
  const parsed = JSON.parse(text);
  return { level: parsed.level, reasoning: String(parsed.reasoning ?? "") };
}

// Bumped whenever SYSTEM_PROMPT, buildScoringUserPrompt, or SCORE_SIGNAL_SCHEMA
// change meaningfully — stamped onto every scored signal (see the crawl
// route) so accuracy from signal_eval_labels can eventually be sliced by
// which prompt produced the score, instead of one number blended across
// every prompt this has ever run.
export const SCORING_PROMPT_VERSION = "v1";

export function scoringRequestParams(context: ScoringContext, signal: SignalToScore) {
  return {
    model: "claude-sonnet-5" as const,
    max_tokens: 300,
    system: cachedSystemPrompt(SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema" as const, schema: SCORE_SIGNAL_SCHEMA } },
    messages: [{ role: "user" as const, content: buildScoringUserPrompt(context, signal) }],
  };
}

export async function scoreSignal(
  context: ScoringContext,
  signal: SignalToScore,
  accountId: string | null
): Promise<ScoringResult> {
  const message = await getAnthropic().messages.create(scoringRequestParams(context, signal));
  recordLlmUsage(accountId, "scoreSignal", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    return parseScoringText(text);
  } catch (err) {
    throw new Error(`Could not parse scoring response: ${text}`, { cause: err });
  }
}

const MENTIONS_SYSTEM_PROMPT = `You read sales call transcripts and pull out only the moments where a named competitor came up — objections, comparisons, feature/price call-outs, or a prospect saying they're evaluating or switching from a competitor. Ignore everything else in the transcript (rapport-building, scheduling, unrelated product discussion).

Respond with strict JSON only, no markdown, matching this shape exactly:
{"mentions": [{"competitor": "<name, must exactly match one from the watch list>", "mention": "<one sentence, e.g. 'Prospect said Acme's pricing was 30% cheaper for the same seat count'>"}]}

If no named competitor was mentioned, respond {"mentions": []}. Keep each mention to one sentence, written as a plain fact a marketing lead can act on — no filler like "the prospect mentioned that". Tag each mention with exactly which competitor from the watch list it's about — don't guess if the transcript doesn't name one specifically.`;

const MENTIONS_SCHEMA = {
  type: "object",
  properties: {
    mentions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          competitor: { type: "string" },
          mention: { type: "string" },
        },
        required: ["competitor", "mention"],
        additionalProperties: false,
      },
    },
  },
  required: ["mentions"],
  additionalProperties: false,
} as const;

export type CompetitorMention = { competitor: string; mention: string };

// Distills raw call transcripts down to the sentences that actually mention
// a competitor by name, so the scorer gets a short list of facts instead of
// megabytes of transcript. One call per transcript, capped and truncated to
// keep cost/latency bounded during a cron run. Each mention is tagged with
// which competitor it's about so a signal about Competitor A doesn't get
// scored using a call mention about Competitor B.
export async function extractCompetitorMentions(
  transcripts: { title: string; transcriptText: string }[],
  competitorNames: string[],
  accountId: string | null
): Promise<CompetitorMention[]> {
  if (transcripts.length === 0 || competitorNames.length === 0) return [];

  const results = await Promise.allSettled(
    transcripts.slice(0, 10).map(async (call) => {
      const userPrompt = `Competitors to watch for: ${competitorNames.join(", ")}

Call: ${call.title}
Transcript: ${call.transcriptText.slice(0, 8000)}

Extract competitor mentions.`;

      const message = await getAnthropic().messages.create({
        model: "claude-sonnet-5",
        max_tokens: 400,
        system: cachedSystemPrompt(MENTIONS_SYSTEM_PROMPT),
        output_config: { format: { type: "json_schema", schema: MENTIONS_SCHEMA } },
        messages: [{ role: "user", content: userPrompt }],
      });
      recordLlmUsage(accountId, "extractCompetitorMentions", message.model, message.usage);

      const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
      const parsed = JSON.parse(text);
      const mentions = Array.isArray(parsed.mentions) ? parsed.mentions : [];
      return mentions
        .filter((m: unknown): m is { competitor: unknown; mention: unknown } => Boolean(m))
        .map((m: { competitor: unknown; mention: unknown }) => ({
          competitor: String(m.competitor ?? ""),
          mention: String(m.mention ?? ""),
        }))
        .filter((m: CompetitorMention) => m.competitor && m.mention);
    })
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

const HEADLINE_RELEVANCE_SYSTEM_PROMPT = `You check whether news headlines actually refer to a specific named company, not a different entity (a place, fund, person, or unrelated business) that merely shares part of its name. This matters because some company names are common words or short strings that collide with unrelated proper nouns — e.g. a company called "Square" versus "Union Square," "Times Square," or "Madison Square Garden," which are unrelated places, funds, or venues.

Respond with strict JSON only, no markdown, matching this shape exactly:
{"relevant": [true, false, ...]}

One boolean per headline, in the same order given. true only if the headline is genuinely about the named company itself (its product, business, funding, leadership, or industry activity) — not merely containing the same word as part of an unrelated proper noun. If genuinely unsure, default to true (better to keep a maybe than to hide something real).`;

const HEADLINE_RELEVANCE_SCHEMA = {
  type: "object",
  properties: {
    relevant: { type: "array", items: { type: "boolean" } },
  },
  required: ["relevant"],
  additionalProperties: false,
} as const;

// Filters out headlines that just happen to contain a competitor's name as
// part of an unrelated proper noun (a company called "Square" vs. "Union
// Square Ventures", "Times Square", etc.) — the keyword-AND at the query
// level in scraping.ts catches most sports/idiom/hobby noise, but can't
// distinguish two legitimately business-shaped entities from a bare keyword
// match alone. One batched call per competitor per crawl run, not one per
// headline, to keep this cheap.
export async function filterRelevantHeadlines(
  competitorName: string,
  competitorDomain: string | null,
  headlines: { title: string }[],
  accountId: string | null
): Promise<boolean[]> {
  if (headlines.length === 0) return [];

  const userPrompt = `Company: ${competitorName}${competitorDomain ? ` (${competitorDomain})` : ""}

Headlines:
${headlines.map((h, i) => `${i}. ${h.title}`).join("\n")}

For each headline, is it genuinely about this company?`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system: cachedSystemPrompt(HEADLINE_RELEVANCE_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: HEADLINE_RELEVANCE_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "filterRelevantHeadlines", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const relevant = Array.isArray(parsed.relevant) ? parsed.relevant : [];
    // Pad/truncate defensively to match headline count, defaulting to true
    // (keep) for any mismatch rather than silently dropping real signals.
    return headlines.map((_, i) => (typeof relevant[i] === "boolean" ? relevant[i] : true));
  } catch {
    // Parse failure: fail open (keep everything) rather than lose real
    // signals to a formatting glitch in the filter itself.
    return headlines.map(() => true);
  }
}

const SUGGEST_COMPETITORS_SYSTEM_PROMPT = `You suggest likely competitors for a B2B company based on its positioning and ideal customer profile. Infer the industry/category from that text, then name real, well-known companies or products that plausibly compete for the same buyers — the kind of names a marketing lead would actually want to track, not obscure or fabricated ones.

Respond with strict JSON only, no markdown, matching this shape exactly:
{"competitors": [{"name": "<company name>", "domain": "<best-guess bare domain, e.g. 'acme.com', no protocol>"}]}

Return up to 8, ordered most-to-least likely to be a real competitive threat. If the positioning/ICP is too vague to infer a specific market, make a best-effort guess at the closest general category rather than returning an empty list.`;

const SUGGEST_COMPETITORS_SCHEMA = {
  type: "object",
  properties: {
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          domain: { type: "string" },
        },
        required: ["name", "domain"],
        additionalProperties: false,
      },
    },
  },
  required: ["competitors"],
  additionalProperties: false,
} as const;

export type SuggestedCompetitor = { name: string; domain: string };

export async function suggestCompetitors(
  companyName: string,
  positioning: string | null,
  icp: string | null
): Promise<SuggestedCompetitor[]> {
  const userPrompt = `Company: ${companyName}
Positioning: ${positioning ?? "(not provided)"}
ICP: ${icp ?? "(not provided)"}

Suggest likely competitors.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: cachedSystemPrompt(SUGGEST_COMPETITORS_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: SUGGEST_COMPETITORS_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  // Always pre-account (see the route's own comment) — nothing to attribute to.
  recordLlmUsage(null, "suggestCompetitors", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";

  try {
    const parsed = JSON.parse(text);
    const competitors = Array.isArray(parsed.competitors) ? parsed.competitors : [];
    return competitors
      .map((c: { name?: unknown; domain?: unknown }) => ({
        name: String(c.name ?? "").trim(),
        domain: String(c.domain ?? "")
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, ""),
      }))
      .filter((c: SuggestedCompetitor) => c.name);
  } catch (err) {
    throw new Error(`Could not parse competitor suggestion response: ${text}`, { cause: err });
  }
}

const ASK_SYSTEM_PROMPT = `You are Ripplewatch's competitive-intelligence analyst for one specific company. Answer the user's question using only the business context and recent signals provided below — don't invent competitor facts that aren't in the context. If the context doesn't contain enough to answer, say so plainly and suggest what to track instead of guessing.

Write like an analyst briefing a colleague, not a search engine: a direct answer first, then the specific signals that back it up (name the competitor and what happened). Keep it tight — a few sentences to a short paragraph, not a report. Plain text only, no markdown headers.`;

export type AskContextSignal = {
  competitor: string;
  type: string;
  title: string;
  occurredOn: string;
  relevanceLevel: string | null;
  relevanceReasoning: string | null;
  summary: string | null;
};

export async function answerQuestion(
  question: string,
  context: {
    companyName: string;
    positioning: string | null;
    icp: string | null;
    competitors: string[];
    signals: AskContextSignal[];
  },
  accountId: string | null
): Promise<string> {
  const signalLines = context.signals
    .map((s) => {
      const verdict = s.relevanceLevel ? `[${s.relevanceLevel}] ${s.relevanceReasoning ?? ""}` : s.summary ?? "";
      return `- ${s.occurredOn} · ${s.competitor} · ${s.type} · ${s.title} — ${verdict}`;
    })
    .join("\n");

  const userPrompt = `Company: ${context.companyName}
Positioning: ${context.positioning ?? "(not provided)"}
ICP: ${context.icp ?? "(not provided)"}
Tracked competitors: ${context.competitors.join(", ") || "(none)"}

Recent signals (last ~90 days):
${signalLines || "(none recorded yet)"}

Question: ${question}`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system: cachedSystemPrompt(ASK_SYSTEM_PROMPT),
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "answerQuestion", message.model, message.usage);

  return message.content.find((block) => block.type === "text")?.text ?? "";
}

const NEWS_SEARCH_SYSTEM_PROMPT = `You research a named competitor using web search and report back only what's relevant to competitive intelligence for a B2B SaaS company: pricing or plan changes, new features, funding rounds, notable hires, leadership changes, or press coverage of a strategic shift. Ignore generic blog content, unrelated press mentions, and anything not tied to a specific dated event.

Respond with strict JSON only, no markdown, matching this shape exactly:
{"headlines": [{"title": "<factual headline, not a summary of the article's angle>", "summary": "<one sentence on what specifically happened>", "url": "<source URL, or null if unavailable>"}]}

Return at most 8 items, most recent first. If nothing relevant turns up, respond {"headlines": []} rather than including generic or stale results just to fill the list.`;

const NEWS_SEARCH_SCHEMA = {
  type: "object",
  properties: {
    headlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          url: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["title", "summary", "url"],
        additionalProperties: false,
      },
    },
  },
  required: ["headlines"],
  additionalProperties: false,
} as const;

export type SearchedHeadline = { title: string; summary: string; url: string | null };

// Real alternative to the free Google News RSS scrape in scraping.ts —
// costs a per-search fee on top of the model call (unlike the RSS path,
// which is free), so this is deliberately NOT wired into the daily crawl.
// Exists as a working, tested option to switch to later if the free
// approach still comes up thin after a few real days of crawling.
export async function searchCompetitorNews(
  competitorName: string,
  accountId: string | null = null
): Promise<SearchedHeadline[]> {
  // web_search_20260209's built-in dynamic filtering runs a whole internal
  // thinking/code-execution loop before producing the final answer — verified
  // live that 1024 wasn't nearly enough and cut the response off mid-process
  // (stop_reason: "max_tokens", zero headlines written yet). This is real
  // overhead the free RSS scrape in scraping.ts doesn't have.
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: cachedSystemPrompt(NEWS_SEARCH_SYSTEM_PROMPT),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    output_config: { format: { type: "json_schema", schema: NEWS_SEARCH_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Research "${competitorName}" for recent competitive-intelligence-relevant news.`,
      },
    ],
  });
  recordLlmUsage(accountId, "searchCompetitorNews", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const headlines = Array.isArray(parsed.headlines) ? parsed.headlines : [];
    return headlines.map((h: { title?: unknown; summary?: unknown; url?: unknown }) => ({
      title: String(h.title ?? ""),
      summary: String(h.summary ?? ""),
      url: h.url ? String(h.url) : null,
    }));
  } catch (err) {
    throw new Error(`Could not parse news search response: ${text}`, { cause: err });
  }
}
