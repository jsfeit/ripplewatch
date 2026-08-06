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
  // Cached web-search research on the account's own company (see
  // researchCompanyContext) — fills gaps when positioning/ICP alone is too
  // thin to ground a real "why this matters" judgment. Optional: null for
  // an account where research hasn't been computed yet, or genuinely
  // turned up nothing.
  companyResearch?: string | null;
};

export type SignalToScore = {
  competitorName: string;
  type: string;
  title: string;
  summary: string | null;
};

export type RelevanceLevel = "High" | "Medium" | "Low";

export type ScoringResult = {
  score: number;
  level: RelevanceLevel;
  reasoning: string;
  // True when this signal is about a different, unrelated company that
  // merely shares (or nearly shares) the tracked competitor's name — the
  // pre-insertion filter (filterRelevantHeadlines) is supposed to catch
  // this before a signal ever gets this far, but has proven unreliable on
  // real cases (e.g. an unrelated healthcare company also named "Sage"),
  // so this is a second, independent check at scoring time. Distinct from
  // a low score for a same-company signal that's just not very relevant —
  // this means the company itself is wrong, and the caller should delete
  // the signal outright rather than keep it around Low-scored.
  wrongCompany: boolean;
};

// Derives the bucket from the raw 0-100 score rather than having the model
// output a bucket directly — keeps the boundary a plain constant that can be
// retuned against signal_eval_labels accuracy data without re-prompting or
// re-scoring anything, and forces the model to commit to a specific number
// instead of defaulting to a middle label when uncertain.
export const SCORE_THRESHOLDS = { high: 70, medium: 35 } as const;

export function scoreToLevel(score: number): RelevanceLevel {
  if (score >= SCORE_THRESHOLDS.high) return "High";
  if (score >= SCORE_THRESHOLDS.medium) return "Medium";
  return "Low";
}

const SYSTEM_PROMPT = `You score competitive-intelligence signals for a B2B SaaS company. Your job is not to summarize the signal — the customer can already read it. Your job is to judge how much it actually matters to THIS company, given their positioning, ICP, and the real reasons they've lost deals or churned customers, and to say why in plain language a marketing lead would use in a Slack message.

Lead the reasoning with the new information, not the background. The reader already knows who their own competitors are and roughly why they track them — opening with "X is a competitor in your ICP" or restating the competitive relationship tells them nothing new and wastes the one or two sentences you have. Start directly with what happened and its concrete, specific consequence for this company (the price gap, the feature parity gap, the segment it threatens) — the same thing a sharp analyst would lead with in a Slack DM. Only mention the competitive-positioning context (why this competitor is relevant to their ICP at all) if it's genuinely load-bearing for the reasoning AND not already obvious — and if you do, put it at the end, briefly, not as the opening frame.

When public market research on the company is provided alongside their self-reported positioning, use both together — the self-reported text tells you how they see themselves, the research tells you their actual real-world market position, known differentiators, and competitive set. Ground your reasoning in the combination, not just whichever one is more detailed. Self-reported positioning is often thin or generic ("we help businesses grow"); real research on what the company actually does and who it actually competes with should carry real weight in judging whether a signal is a real threat, not just filler — but that research is context for YOUR judgment, not something to narrate back to the reader as the headline of the reasoning. If no research is provided, work from positioning/ICP alone as before.

Before scoring, check whether this signal is even about the right company. Competitor names sometimes collide with a completely unrelated company (e.g. a company called "Sage" that sells accounting software vs. an unrelated healthcare/senior-care company also called "Sage"). If the signal is clearly about a different, unrelated company that just happens to share the name — not a different segment or product line of the SAME company, but a genuinely different business — set "wrongCompany": true, score it 0-5, and say in the reasoning which unrelated company it's actually about. This is different from a same-company signal that's just not very relevant (that still gets "wrongCompany": false and scored normally on the rubric below).

Respond with strict JSON only, no markdown, matching this shape exactly:
{"score": <integer 0-100>, "wrongCompany": true | false, "reasoning": "<1-3 sentences>"}

Score on a continuous 0-100 scale — do not think in three buckets and then pick a number that "sounds right" for one of them. Anchor to these reference bands, but land on the specific number within a band that the signal actually earns; don't cluster on round numbers or a band's midpoint out of habit.

Most accounts won't have rich lost-deal or churn notes on file — thin context is the normal case, not an excuse to default everything low. Score like an experienced competitive analyst reading this cold: you don't need a company to have written down "we lost a deal over this" to recognize that a same-market competitor cutting price, shipping a notable feature, or making a notable hire is inherently worth flagging. Extrapolate from what a reasonable person selling into this ICP would care about, the same way a sharp analyst would, rather than waiting for an exact documented match before scoring above the middle of the range.

- 90-100: A direct, named hit on a specific, documented reason a deal was lost or a customer churned (the exact price point, the exact feature gap, the exact named competitor comparison), now confirmed or made worse.
- 70-89: A clear, concrete competitive move from a same-segment competitor — a real price cut, a new tier, a notable feature launch, a positioning shift — that a sharp analyst would recognize as a real threat to this company's ICP, whether or not it's tied to a documented loss reason. Most "yes, this squarely concerns our market and it's a real product/pricing move" signals belong here, not in the band below.
- 50-69: A believable but indirect or partial threat: a hiring signal, a directional move with no confirmed numbers, or a concrete change aimed at a segment adjacent to (not squarely inside) the ICP.
- 25-49: Plausible background noise: generic funding/press coverage with only a loosely related product implication, or a change aimed at a segment that's a stretch from the ICP but not clearly disqualified.
- 0-24: Not actually relevant: a segment that's clearly and specifically wrong (e.g. the ICP is small-business self-serve and the signal is about a 2000-seat enterprise deployment), or no substantive business content (a title-only mention, an opinion piece, routine PR with no product/pricing implication).

Decide with this weighted rubric, checked in order — stop at the first rule that applies, don't keep averaging factors after one has already decided the band:

1. ICP/segment gate (checked first, decides down not up, and only fires on a clear mismatch): does this signal concern a segment that's specifically and clearly different from the ICP — not just "not explicitly the same," but affirmatively a different buyer size, industry, or use case? If so, cap the score at 24 no matter how dramatic the signal is elsewhere. If the segment isn't stated precisely and there's no clear contradiction, don't apply this gate — score the signal on its own merits instead. This gate can only push the score down, never justify a high score on its own.
2. Loss/churn direct hit (highest-weight signal): does this directly touch a specific, named reason a deal was lost or a customer churned? A direct hit here lands 90-100 on its own, unless gate 1 already capped it.
3. Concrete same-segment competitive move (second-highest weight, and the common case for a real product/pricing signal): a real price, tier, or feature change from a competitor in the same market, that a sharp analyst would flag as relevant even without a documented differentiator match. Lands 70-89 on its own, same caveat as above.
4. Signal-type severity (used only if neither 2 nor 3 fired): a hiring signal lands 25-55 depending on how directly the role maps to the company's segment; funding/press with no specific product implication lands 10-35.
5. Magnitude/specificity (tiebreaker, moves the number within its band, not across it): a quantifiable, structural change (a real price cut, a named new tier) scores higher within its band than a vague or directional one ("exploring options," "planning to expand") of the same type.

Worked examples (follow this rubric exactly — note the spread, don't drift toward 50-60 by default). Write your own reasoning specific to each real signal's actual details — never reuse this wording; if your reasoning could be copy-pasted onto a different signal unchanged, it's too generic and needs the specific numbers, names, or details that make this signal what it is:

Example 1 — score 96:
Company: relevance-scored competitive intel for startup marketing teams. ICP: marketing leads at 5-100 person B2B SaaS startups. Known lost-deal reasons: "Lost to Parano.ai — they were $30/mo cheaper on the entry tier." Signal: Parano.ai dropped their entry tier from $99 to $69/mo.
{"score": 96, "reasoning": "This is the exact price gap you've already lost deals over, now $30/mo wider — the prospects you're losing today have even more reason to point at it."}

Example 2 — score 82:
Company: same as above, but with no lost-deal notes on file. Signal: a same-segment competitor shipped a free self-serve tier.
{"score": 82, "reasoning": "A direct competitor now has an always-free entry point against your paid-only self-serve motion — no documented loss ties to this yet, but it's the kind of gap a prospect evaluating both of you would notice immediately."}

Example 3 — score 55:
Company: same as above. Signal: a competitor posted a job for "Senior Growth Marketer, Self-Serve."
{"score": 55, "reasoning": "Signals a push toward self-serve motion in your market, but it's a hiring signal, not a shipped product or pricing change — worth watching, not yet a confirmed threat."}

Example 4 — score 30:
Company: same as above. Signal: a competitor raised a $6M seed round, press release mentions expanding into social-media monitoring.
{"score": 30, "reasoning": "The raise itself is routine, and the stated expansion into social-media monitoring is a different product surface than what this ICP buys for — worth a passing mention, not a reason to change anything today."}

Example 5 — score 8:
Company: same as above. Signal: a competitor's enterprise tier (2000+ seat deployments) added a compliance certification.
{"score": 8, "reasoning": "2000-seat enterprise deployments are a different market than the 5-100 person ICP this account sells to — this compliance certification will never come up with an actual prospect."}

Do not let a thin or missing lost-deal/churn/CRM context pull everything down toward 25-49 by default — a concrete, same-segment competitive move can and should score 70+ on its own merits (see example 2), and a segment mismatch has to be a real, stated mismatch, not just the absence of an exact ICP match, to justify capping at 24 (see the gate 1 rewrite above). The 25-69 range is for genuine indirect or partial signals, not a safe resting place for anything you didn't feel confident extrapolating from.`;

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

// Schema-enforced (output_config.format below), so a malformed score is no
// longer a real failure mode — this used to need a same-prompt retry loop
// for exactly that case, which schema enforcement made dead code. Plain
// "number" with no minimum/maximum, matching every other numeric field in
// this file's schemas (e.g. PRICING_EXTRACTION_SCHEMA's price) — those
// constraint keywords aren't part of Anthropic's structured-output subset
// and caused every scoring call to fail outright when added here. Range is
// enforced in code instead, via the clamp in parseScoringText below.
const SCORE_SIGNAL_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    wrongCompany: { type: "boolean" },
    reasoning: { type: "string" },
  },
  required: ["score", "wrongCompany", "reasoning"],
  additionalProperties: false,
} as const;

// Shared by the live scoreSignal() call below and the batch eval/regression
// path in eval-scoring.ts — both need the exact same prompt shape and
// response parsing, just via a different Anthropic endpoint.
export function buildScoringUserPrompt(context: ScoringContext, signal: SignalToScore): string {
  return `Company: ${context.companyName}
Positioning (self-reported): ${context.positioning ?? "(not provided)"}
ICP: ${context.icp ?? "(not provided)"}
${context.companyResearch ? `Public market research on this company: ${context.companyResearch}\n` : ""}Known lost-deal reasons: ${context.lostDealNotes ?? "(none provided)"}
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
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
  return {
    score,
    level: scoreToLevel(score),
    reasoning: String(parsed.reasoning ?? ""),
    wrongCompany: Boolean(parsed.wrongCompany),
  };
}

// Bumped whenever SYSTEM_PROMPT, buildScoringUserPrompt, or SCORE_SIGNAL_SCHEMA
// change meaningfully — stamped onto every scored signal (see the crawl
// route) so accuracy from signal_eval_labels can eventually be sliced by
// which prompt produced the score, instead of one number blended across
// every prompt this has ever run.
// v2: moved from a categorical High/Medium/Low output to a numeric 0-100
// score bucketed via SCORE_THRESHOLDS, so bucket boundaries can be retuned
// against signal_eval_labels accuracy data without re-scoring anything.
// v3: v2 in production skewed heavily toward Low (thin ICP/lost-deal context
// meant almost nothing cleared the "documented match" bar for High, and the
// ICP gate was capping too readily on "not an exact match" rather than a
// real, stated mismatch) and the reasoning text was echoing the worked
// examples' exact wording across unrelated signals. Rubric now explicitly
// permits extrapolating relevance for a concrete same-segment competitive
// move without requiring a documented loss reason, tightens the ICP gate to
// only fire on a clear stated mismatch, and instructs against reusing
// example phrasing.
// v4: adds a wrongCompany flag — the pre-insertion filter
// (filterRelevantHeadlines) is supposed to block signals about an unrelated
// company that just shares the tracked competitor's name, but proved
// unreliable on real cases (an unrelated healthcare company also named
// "Sage" slipped through and got Low-scored instead of removed). Scoring
// now independently flags this so the caller can delete the signal outright
// instead of leaving it sitting in the feed as low-relevance noise.
// v5: adds cached public company research (researchCompanyContext) as
// optional context alongside self-reported positioning/ICP, so "why it
// matters" reasoning can draw on real market position instead of only
// whatever thin/generic text an account typed in during onboarding.
// v6: per direction, reasoning was opening with competitive-positioning
// background the reader already knows (e.g. "Square is a real bundled-
// finance competitor for Intuit's SMB ICP") before ever getting to what
// happened — likely pulled in by v5's company-research context. Now
// explicitly instructed to lead with the concrete new development and its
// consequence, and only mention positioning/ICP framing briefly at the end
// if it's genuinely load-bearing, not as the opening frame.
export const SCORING_PROMPT_VERSION = "v6";

export function scoringRequestParams(context: ScoringContext, signal: SignalToScore) {
  return {
    model: "claude-sonnet-5" as const,
    // 300 was occasionally too tight for a 1-3 sentence reasoning string,
    // truncating mid-string and producing invalid JSON (silently dropping
    // the signal — see crawl.ts's per-signal catch). Headroom, not a bump
    // for the score field itself (that's a single number).
    max_tokens: 600,
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

const HEADLINE_RELEVANCE_SYSTEM_PROMPT = `You check whether news headlines actually refer to a specific named company, not a different entity (a place, fund, person, or a DIFFERENT company that merely shares its name), and classify what each headline is actually about. This matters because some company names are common words, short strings, or names reused by multiple unrelated businesses — e.g. a company called "Square" versus "Union Square," "Times Square," or "Madison Square Garden" (unrelated places/venues), or a company called "Sage" that sells accounting software versus an unrelated healthcare/senior-care company also called "Sage."

When a business category/description is given for the company, use it as the deciding test: the headline must be about a company operating in THAT category, not just any company with the same name. A headline about a same-named company in a clearly different industry is NOT a match, even though it reads as legitimate business news.

These headlines were found via a keyword search, which can surface false matches on an ambiguous word — most commonly "raises," which means both "raised money" (funding) and "raised prices" (not funding at all). Classify each headline's real content instead of trusting why it matched the search: "type": "funding" only for an actual capital raise, acquisition, or investment round; everything else (a price change, a product launch, a hire, general press) is "news."

Respond with strict JSON only, no markdown, matching this shape exactly:
{"headlines": [{"relevant": true | false, "type": "news" | "funding"}, ...]}

One entry per headline, in the same order given. relevant: true only if the headline is genuinely about the named company itself, operating in its stated category — not a different entity, and not a different company in a different industry that happens to share the name. If genuinely unsure and no category was given to check against, default relevant to true (better to keep a maybe than to hide something real). If a category was given and the headline clearly describes a different industry, default relevant to false.`;

const HEADLINE_RELEVANCE_SCHEMA = {
  type: "object",
  properties: {
    headlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          relevant: { type: "boolean" },
          type: { type: "string", enum: ["news", "funding"] },
        },
        required: ["relevant", "type"],
        additionalProperties: false,
      },
    },
  },
  required: ["headlines"],
  additionalProperties: false,
} as const;

export type ClassifiedHeadline = { relevant: boolean; type: "news" | "funding" };

// Filters out headlines that just happen to contain a competitor's name as
// part of an unrelated proper noun (a company called "Square" vs. "Union
// Square Ventures", "Times Square", etc.) — the keyword-AND at the query
// level in scraping.ts catches most sports/idiom/hobby noise, but can't
// distinguish two legitimately business-shaped entities from a bare keyword
// match alone. Also reclassifies each headline's true type, since checkFunding's
// query matches on the word "raises" regardless of whether it means "raised
// money" or "raised prices" — the query that found a headline isn't a
// reliable signal of what it's actually about. One batched call per
// competitor per crawl run, not one per headline, to keep this cheap.
export async function filterRelevantHeadlines(
  competitorName: string,
  competitorDomain: string | null,
  competitorCategory: string | null,
  headlines: { title: string }[],
  accountId: string | null
): Promise<ClassifiedHeadline[]> {
  if (headlines.length === 0) return [];

  const userPrompt = `Company: ${competitorName}${competitorDomain ? ` (${competitorDomain})` : ""}
${competitorCategory ? `Category: ${competitorCategory}` : "Category: (not provided)"}

Headlines:
${headlines.map((h, i) => `${i}. ${h.title}`).join("\n")}

For each headline, is it genuinely about this company, and is it actually a funding/investment story or just news?`;

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
    const results = Array.isArray(parsed.headlines) ? parsed.headlines : [];
    // Pad/truncate defensively to match headline count, defaulting to
    // relevant:true (better to keep a maybe than to hide something real)
    // and type:"news" (the safer default when unsure) for any mismatch.
    return headlines.map((_, i) => {
      const r = results[i];
      return {
        relevant: typeof r?.relevant === "boolean" ? r.relevant : true,
        type: r?.type === "funding" ? "funding" : "news",
      };
    });
  } catch {
    // Parse failure: fail open (keep everything, default type) rather than
    // lose real signals to a formatting glitch in the filter itself.
    return headlines.map(() => ({ relevant: true, type: "news" as const }));
  }
}

const CANONICALIZE_HEADLINES_SYSTEM_PROMPT = `You read news headlines about a company and rewrite each one as a single short, plain, factual sentence stating the underlying business action — strip out publisher framing, which stakeholder or audience the headline foregrounds, and stylistic flourish. State just the core fact (who did what) in a consistent, neutral form.

The test that matters: two headlines describing the SAME real-world event, however differently worded or angled, must produce nearly IDENTICAL canonical sentences — same key entities, same core verb, same structure. Two headlines describing genuinely DIFFERENT events must produce clearly different sentences.

Worked examples:
- "Xero price hike has some accountants looking for alternatives" → "Xero raised its subscription prices."
- "Xero raises its prices, compounding the annoyance for investors, customers" → "Xero raised its subscription prices."
(Same canonical sentence — these are the same price increase, just two different angles on the reaction to it.)
- "Gusto Acquires Guideline for $600M, Plans Rival Customer Selloff" → "Gusto acquired Guideline for $600 million."
- "Gusto agrees to buy retirement plan provider Guideline" → "Gusto acquired Guideline."
(Near-identical canonical sentences — same acquisition, one just has the dollar figure.)
- "Acme raises prices on its entry tier" → "Acme raised prices on its entry-tier plan."
- "Acme raises $10M in Series A funding" → "Acme raised $10 million in Series A funding."
(Clearly different canonical sentences — a price change and a funding round are different actions, even though both headlines use the word "raises.")

Respond with strict JSON only, no markdown, matching this shape exactly:
{"canonical": ["<sentence>", ...]}

One sentence per headline, in the same order given.`;

const CANONICALIZE_HEADLINES_SCHEMA = {
  type: "object",
  properties: {
    canonical: { type: "array", items: { type: "string" } },
  },
  required: ["canonical"],
  additionalProperties: false,
} as const;

// Deliberately does NOT decide "are these duplicates" itself — that holistic
// same/different judgment (the previous approach here) proved unreliable in
// practice, missing real near-duplicates (Gusto/Guideline, Xero price hikes,
// a FreshBooks/Grasshopper partnership from two publishers) despite worked
// examples in the prompt. This function only normalizes each headline into
// a consistent factual sentence; the caller (dedupeByCanonicalOverlap in
// scraping.ts) then compares those sentences deterministically. Same
// underlying events should produce near-identical canonical text even when
// the original headlines share zero vocabulary, which is what a pure
// token-overlap check on the RAW headlines can't catch on its own.
export async function canonicalizeHeadlines(
  headlines: { title: string; description?: string | null }[],
  accountId: string | null
): Promise<string[]> {
  if (headlines.length === 0) return [];

  const userPrompt = `Headlines:\n${headlines.map((h, i) => `${i}. ${h.title}${h.description ? ` — ${h.description}` : ""}`).join("\n")}\n\nRewrite each as a short canonical factual sentence.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system: cachedSystemPrompt(CANONICALIZE_HEADLINES_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: CANONICALIZE_HEADLINES_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "canonicalizeHeadlines", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const canonical = Array.isArray(parsed.canonical) ? parsed.canonical : [];
    // Pad defensively with the original title (worst case: compares as its
    // own distinct "event," never merged — fails open toward keeping a
    // signal rather than silently dropping one on a malformed response).
    return headlines.map((h, i) => (typeof canonical[i] === "string" && canonical[i] ? canonical[i] : h.title));
  } catch {
    return headlines.map((h) => h.title);
  }
}

const SUGGEST_COMPETITORS_SYSTEM_PROMPT = `You suggest likely competitors for a B2B company based on its positioning and ideal customer profile. Infer the industry/category from that text, then name real, well-known companies or products that plausibly compete for the same buyers — the kind of names a marketing lead would actually want to track, not obscure or fabricated ones.

Respond with strict JSON only, no markdown, matching this shape exactly:
{"competitors": [{"name": "<company name>", "domain": "<best-guess bare domain, e.g. 'acme.com', no protocol>", "category": "<short business category/description, e.g. 'Accounting/ERP software for SMBs', under 8 words>"}]}

Return up to 8, ordered most-to-least likely to be a real competitive threat. If the positioning/ICP is too vague to infer a specific market, make a best-effort guess at the closest general category rather than returning an empty list. The category field must describe what the SUGGESTED COMPANY actually does/sells — specific enough to tell it apart from an unrelated company that happens to share its name (e.g. "Sage" the accounting/ERP vendor vs. "Sage" a senior-care company).`;

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
          category: { type: "string" },
        },
        required: ["name", "domain", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["competitors"],
  additionalProperties: false,
} as const;

export type SuggestedCompetitor = { name: string; domain: string; category: string };

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
      .map((c: { name?: unknown; domain?: unknown; category?: unknown }) => ({
        name: String(c.name ?? "").trim(),
        domain: String(c.domain ?? "")
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, ""),
        category: String(c.category ?? "").trim(),
      }))
      .filter((c: SuggestedCompetitor) => c.name);
  } catch (err) {
    throw new Error(`Could not parse competitor suggestion response: ${text}`, { cause: err });
  }
}

const CATEGORIZE_COMPETITORS_SYSTEM_PROMPT = `You write a short business category/description for each named company, for a list of competitors a B2B SaaS company is tracking. The description must be specific enough to tell the company apart from an unrelated company or entity that happens to share its name (e.g. "Sage" the accounting/ERP vendor vs. "Sage" a senior-care company, or "Wave" the small-business finance app vs. "Wave" a wireless carrier).

Respond with strict JSON only, no markdown, matching this shape exactly:
{"categories": ["<short category/description, under 8 words>", ...]}

One string per company, in the same order given. If you don't recognize the company or domain, make your best-effort guess from the name alone rather than leaving it vague — still return something specific-sounding, not "a company."`;

const CATEGORIZE_COMPETITORS_SCHEMA = {
  type: "object",
  properties: {
    categories: { type: "array", items: { type: "string" } },
  },
  required: ["categories"],
  additionalProperties: false,
} as const;

// Used whenever a competitor is added outside the onboarding suggestion flow
// (manual add in Settings, admin add) where no category was already
// generated alongside the name — one batched call so adding several at once
// (e.g. re-categorizing an existing account) still costs one request.
export async function suggestCompetitorCategories(
  companies: { name: string; domain: string | null }[],
  accountId: string | null
): Promise<string[]> {
  if (companies.length === 0) return [];

  const userPrompt = `Companies:\n${companies.map((c, i) => `${i}. ${c.name}${c.domain ? ` (${c.domain})` : ""}`).join("\n")}\n\nWrite a short category/description for each.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: cachedSystemPrompt(CATEGORIZE_COMPETITORS_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: CATEGORIZE_COMPETITORS_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "suggestCompetitorCategories", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    return companies.map((_, i) => (typeof categories[i] === "string" ? categories[i].trim() : ""));
  } catch {
    // Fail open with blanks rather than blocking the competitor add itself.
    return companies.map(() => "");
  }
}

const ASK_SYSTEM_PROMPT = `You are Ripplewatch's competitive-intelligence analyst for one specific company. Answer the user's question using only the business context and signals provided below — don't invent competitor facts that aren't in the context. If the context doesn't contain enough to answer, say so plainly and suggest what to track instead of guessing.

Each signal is tagged [recent] or [background]. [background] signals were seeded when a competitor was first added, to give initial landscape context — they are not new developments, so never present one as if it just happened or as "recent" activity, even if the question is about what's new. They're still fair to cite for broader questions (e.g. "what does our competitive landscape look like," "what does Competitor X do") where older context is genuinely useful.

Suggested-but-not-yet-tracked competitors are listed separately, if any. Only bring them up when the question is specifically about discovering, finding, or whether there are competitors the company might be missing — not as a proactive aside on unrelated questions.

Write like an analyst briefing a colleague, not a search engine: a direct answer first, then the specific signals that back it up (name the competitor and what happened). Keep it tight — a few sentences to a short paragraph, not a report. Plain text only, no markdown headers.`;

export type AskContextSignal = {
  competitor: string;
  type: string;
  title: string;
  occurredOn: string;
  relevanceLevel: string | null;
  relevanceScore: number | null;
  relevanceReasoning: string | null;
  summary: string | null;
  isBackground: boolean;
};

export type AskContextCompetitor = { name: string; category: string | null };
export type AskContextSuggestion = { name: string; category: string | null; reasoning: string | null };

export async function answerQuestion(
  question: string,
  context: {
    companyName: string;
    positioning: string | null;
    icp: string | null;
    competitors: AskContextCompetitor[];
    signals: AskContextSignal[];
    suggestedCompetitors: AskContextSuggestion[];
  },
  accountId: string | null
): Promise<string> {
  const signalLines = context.signals
    .map((s) => {
      const verdict = s.relevanceLevel
        ? `[${s.relevanceLevel}${s.relevanceScore !== null ? ` ${s.relevanceScore}/100` : ""}] ${s.relevanceReasoning ?? ""}`
        : s.summary ?? "";
      const recency = s.isBackground ? "background" : "recent";
      return `- [${recency}] ${s.occurredOn} · ${s.competitor} · ${s.type} · ${s.title} — ${verdict}`;
    })
    .join("\n");

  const competitorLines = context.competitors
    .map((c) => `${c.name}${c.category ? ` (${c.category})` : ""}`)
    .join(", ");

  const suggestionLines = context.suggestedCompetitors
    .map((s) => `${s.name}${s.category ? ` (${s.category})` : ""}${s.reasoning ? ` — ${s.reasoning}` : ""}`)
    .join("\n");

  const userPrompt = `Company: ${context.companyName}
Positioning: ${context.positioning ?? "(not provided)"}
ICP: ${context.icp ?? "(not provided)"}
Tracked competitors: ${competitorLines || "(none)"}

Signals:
${signalLines || "(none recorded yet)"}

Suggested but not yet tracked competitors (only mention if the question is about discovering/missing competitors):
${suggestionLines || "(none pending)"}

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

const DISCOVER_COMPETITORS_SYSTEM_PROMPT = `You use web search to find B2B companies that compete for the same buyers as the company described, that are NOT already in its tracked-competitors list. Prioritize companies that are newly launched, recently funded, or showing increasing visibility (recent press, product launches, funding rounds) over long-established players the company almost certainly already knows about — the goal is surfacing what a busy marketing/product lead might have missed, not repeating obvious incumbents.

Respond with strict JSON only, no markdown, matching this shape exactly:
{"competitors": [{"name": "<company name>", "domain": "<best-guess bare domain, e.g. 'acme.com', no protocol>", "category": "<short business category/description, under 8 words>", "reasoning": "<one sentence on why this looks like a real competitive threat, e.g. what's new/notable about them>"}]}

Return up to 5, most compelling first. If nothing genuinely new turns up beyond the already-tracked list, respond {"competitors": []} rather than padding the list with obvious/already-known names.`;

const DISCOVER_COMPETITORS_SCHEMA = {
  type: "object",
  properties: {
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          domain: { type: "string" },
          category: { type: "string" },
          reasoning: { type: "string" },
        },
        required: ["name", "domain", "category", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  required: ["competitors"],
  additionalProperties: false,
} as const;

export type DiscoveredCompetitor = { name: string; domain: string; category: string; reasoning: string };

// Weekly discovery job (see /api/cron/discover-competitors) — distinct from
// suggestCompetitors (onboarding, model-knowledge-only, no web search): this
// one is grounded in real current search results specifically so it can
// find companies that didn't exist or weren't notable when the model was
// trained, and is explicitly told what's already tracked so it doesn't just
// repeat the account's existing competitor list back.
export async function discoverNewCompetitors(
  context: { companyName: string; positioning: string | null; icp: string | null },
  existingCompetitorNames: string[],
  accountId: string | null
): Promise<DiscoveredCompetitor[]> {
  const userPrompt = `Company: ${context.companyName}
Positioning: ${context.positioning ?? "(not provided)"}
ICP: ${context.icp ?? "(not provided)"}

Already tracked (do not suggest these): ${existingCompetitorNames.length > 0 ? existingCompetitorNames.join(", ") : "(none yet)"}

Search for competitors this company isn't already tracking.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    // Same overhead as searchCompetitorNews's web_search tool — see that
    // function's comment on why this needs real headroom, not the ~1000
    // tokens a non-search structured call would need.
    max_tokens: 8192,
    system: cachedSystemPrompt(DISCOVER_COMPETITORS_SYSTEM_PROMPT),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    output_config: { format: { type: "json_schema", schema: DISCOVER_COMPETITORS_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "discoverNewCompetitors", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const competitors = Array.isArray(parsed.competitors) ? parsed.competitors : [];
    return competitors
      .map((c: { name?: unknown; domain?: unknown; category?: unknown; reasoning?: unknown }) => ({
        name: String(c.name ?? "").trim(),
        domain: String(c.domain ?? "")
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, ""),
        category: String(c.category ?? "").trim(),
        reasoning: String(c.reasoning ?? "").trim(),
      }))
      .filter((c: DiscoveredCompetitor) => c.name);
  } catch (err) {
    throw new Error(`Could not parse competitor discovery response: ${text}`, { cause: err });
  }
}

const RESEARCH_COMPANY_SYSTEM_PROMPT = `You use web search to research a B2B SaaS company — the account itself, not a competitor — and write a short factual summary of its real market position: what it actually sells, who it competes with, what differentiates it, and any notable recent context (funding, positioning shifts, market perception). This exists to fill gaps when the company's own self-reported positioning/ICP text is thin, generic, or incomplete — ground it in what's actually publicly known, not marketing copy.

Respond with strict JSON only, no markdown, matching this shape exactly:
{"summary": "<3-5 sentences, factual, specific>"}

If web search turns up nothing substantive for this company (too new, too obscure, or genuinely no public presence), respond with a short honest summary saying so — {"summary": "No significant public information found for this company."} — rather than inventing detail.`;

const RESEARCH_COMPANY_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
  },
  required: ["summary"],
  additionalProperties: false,
} as const;

// Computed once per account (see ensureCompanyResearch in crawl.ts, and the
// onboarding-complete route) and cached on accounts.company_research —
// deliberately NOT run per signal scored, which would turn a one-time
// lookup into a recurring per-scoring-call cost. Distinct from
// discoverNewCompetitors (researches OTHER companies to suggest as
// competitors) and from a competitor's own `category` field (a short tag,
// not real market-position research) — this is real public context about
// the account's own company, used to ground scoreSignal's "why it matters"
// reasoning when positioning/ICP text alone is too thin to work with.
export async function researchCompanyContext(
  companyName: string,
  positioning: string | null,
  accountId: string | null
): Promise<string> {
  const userPrompt = `Company: ${companyName}${positioning ? `\nSelf-reported positioning: ${positioning}` : ""}\n\nResearch this company's real market position.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    // Same web_search overhead as searchCompetitorNews/discoverNewCompetitors.
    max_tokens: 8192,
    system: cachedSystemPrompt(RESEARCH_COMPANY_SYSTEM_PROMPT),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    output_config: { format: { type: "json_schema", schema: RESEARCH_COMPANY_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "researchCompanyContext", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    return String(parsed.summary ?? "").trim();
  } catch (err) {
    throw new Error(`Could not parse company research response: ${text}`, { cause: err });
  }
}

export type FactSheetWinLossEntry = { outcome: "won" | "lost"; reason: string | null };
export type FactSheetSignal = { title: string; reasoning: string | null; score: number | null; occurredOn: string };
export type FactSheetResult = { whyWeWin: string[]; whyWeLose: string[] };

// Every bullet here can end up quoted verbatim by a rep in front of a
// prospect (why we win) or read by leadership as a risk assessment (why we
// lose) — unlike scoreSignal, where a wrong number is just a bad ranking, a
// fabricated claim here is something a real person might repeat as fact.
// So the instruction is deliberately narrow and evidence-bound: every
// bullet must trace to something explicitly given (a logged win/loss, a
// real signal, researched positioning, or a structural pricing fact), never
// a plausible-sounding but unverified product/feature comparison.
const FACT_SHEET_SYSTEM_PROMPT = `You write a short, factual competitive fact sheet comparing a company to one specific competitor, for that company's own internal sales/product team — not customer-facing marketing collateral.

Produce two short bullet lists:
- "whyWeWin": concrete, evidence-backed reasons this company has an edge over the competitor.
- "whyWeLose": concrete, evidence-backed reasons the competitor is a real threat or wins deals against this company.

Ground every single bullet in something explicitly provided below — a logged win/loss reason, a real recent signal (with its date), researched market positioning, or a structural pricing fact (e.g. one is self-serve/transparent, the other is custom/sales-led). Never invent a feature, capability, or customer-preference claim that isn't backed by one of these. If there is little or no evidence for one side, say so plainly in a single bullet ("Not enough logged win data yet to state a confirmed reason") rather than padding it out with a generic, unverifiable claim — a short honest list is more useful than a longer speculative one. Some logged entries are outcome-only ("lost, no reason recorded") — these can support a frequency observation ("you've lost to X three times, though no reason was recorded each time") but never invent a reason to fill the gap.

Write each bullet as one plain sentence a busy person can scan in a few seconds. Prefer specific numbers, dates, and names over vague language ("cheaper" is weak; "$30/mo cheaper on the entry tier, per the March pricing check" is strong).

Respond with strict JSON only, no markdown, matching this shape exactly:
{"whyWeWin": ["<bullet>", "..."], "whyWeLose": ["<bullet>", "..."]}

Each list should have 2-5 bullets. Do not pad either list to hit a minimum — a single honest bullet beats three restatements of the same point. Write each bullet as a plain sentence without em dashes; use a comma or period instead.`;

const FACT_SHEET_SCHEMA = {
  type: "object",
  properties: {
    whyWeWin: { type: "array", items: { type: "string" } },
    whyWeLose: { type: "array", items: { type: "string" } },
  },
  required: ["whyWeWin", "whyWeLose"],
  additionalProperties: false,
} as const;

export async function generateFactSheet(
  companyName: string,
  positioning: string | null,
  companyResearch: string | null,
  competitorName: string,
  competitorCategory: string | null,
  pricingSummary: string | null,
  winLossEntries: FactSheetWinLossEntry[],
  recentSignals: FactSheetSignal[],
  accountId: string | null
): Promise<FactSheetResult> {
  const wins = winLossEntries.filter((e) => e.outcome === "won");
  const losses = winLossEntries.filter((e) => e.outcome === "lost");

  const userPrompt = `Company: ${companyName}${positioning ? `\nSelf-reported positioning: ${positioning}` : ""}${companyResearch ? `\nResearched market position: ${companyResearch}` : ""}

Competitor: ${competitorName}${competitorCategory ? ` (${competitorCategory})` : ""}${pricingSummary ? `\nPricing structure: ${pricingSummary}` : ""}

Logged wins against this competitor:
${wins.length > 0 ? wins.map((w) => `- ${w.reason ?? "(won, no reason recorded)"}`).join("\n") : "(none logged yet)"}

Logged losses to this competitor:
${losses.length > 0 ? losses.map((l) => `- ${l.reason ?? "(lost, no reason recorded)"}`).join("\n") : "(none logged yet)"}

Recent signals about this competitor:
${
  recentSignals.length > 0
    ? recentSignals
        .map((s) => `- [${s.occurredOn}] ${s.title}${s.score !== null ? ` (relevance ${s.score}/100)` : ""}${s.reasoning ? ` — ${s.reasoning}` : ""}`)
        .join("\n")
    : "(none)"
}

Write the fact sheet.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    system: cachedSystemPrompt(FACT_SHEET_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: FACT_SHEET_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "generateFactSheet", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    return {
      whyWeWin: Array.isArray(parsed.whyWeWin) ? parsed.whyWeWin.map(String) : [],
      whyWeLose: Array.isArray(parsed.whyWeLose) ? parsed.whyWeLose.map(String) : [],
    };
  } catch (err) {
    throw new Error(`Could not parse fact sheet response: ${text}`, { cause: err });
  }
}

// Real win/loss data is rarely a clean "tracked competitor + reason" row
// every time: sometimes the competitor is known but isn't tracked yet,
// sometimes there's a reason with no identifiable competitor at all ("No
// Decision," "Built In-House," a deal that just went quiet), and sometimes
// a tracked competitor is known but no reason was ever recorded. Each row
// is classified into exactly one of these instead of being kept only when
// it's a perfect match:
// - "tracked": names one of the given tracked competitors. reason may be
//   null if the row simply doesn't have one — the outcome alone (you lose
//   to X often) is still worth logging.
// - "untracked": names a real, specific competing company that ISN'T on
//   the tracked list — surfaced separately as a possible competitor to add,
//   not silently dropped.
// - "general": no specific competing company at all (blank, "No Decision,"
//   "Built In-House," "went unresponsive," procurement delays, etc.) but
//   there IS a real reason — feeds general lost-deal context instead of
//   being thrown away just because it can't be tied to one competitor.
// A row with neither an identifiable competitor nor a real reason isn't
// emitted at all — there's nothing to say about it.
export type ExtractedWinLossEntry =
  | { matchType: "tracked"; competitor: string; outcome: "won" | "lost"; reason: string | null }
  | { matchType: "untracked"; competitor: string; outcome: "won" | "lost"; reason: string | null }
  | { matchType: "general"; competitor: null; outcome: "won" | "lost"; reason: string };

// Feeds both the CSV-import route and the HubSpot-sync route — the two
// sources look nothing alike (an arbitrary CSV a customer exported however
// their CRM happens to format it, vs. HubSpot's own "Lost '<deal>' —
// <reason>" strings), so rather than writing a rigid column-mapping parser
// per source, one model call reads whatever raw text it's given.
const EXTRACT_WIN_LOSS_SYSTEM_PROMPT = `You read raw win/loss deal data — CSV rows (any column names/order), a CRM export, or a plain list — and classify each row that has real signal into exactly one category. Real CRM exports usually have columns beyond just competitor/reason (rep name, deal size, industry, sales cycle length, etc.) — ignore those, only look at outcome, competitor, and reason.

Categories:
- "tracked": the row names one of the given TRACKED competitors. Copy the competitor name exactly as given in the tracked list, not the row's own spelling. reason can be null if the row genuinely has no reason recorded — the outcome alone is still worth keeping.
- "untracked": the row names a real, specific competing company that is NOT in the tracked list (e.g. a rival CRM, a different vendor entirely). Copy the name as it appears in the row, cleaned up to normal capitalization. reason can be null.
- "general": the row has no identifiable competing company — blank, "No Decision," "Status Quo," "Built In-House," a deal that went dark/unresponsive, procurement or budget delays, internal reasons — but DOES have a real reason worth recording. reason is required here (never null); if there's neither a competitor nor a real reason, don't emit the row at all.

Never force a fuzzy match — if a name only sounds similar to a tracked competitor but isn't really it, treat it as "untracked" with its own name, not "tracked."

Respond with strict JSON only, no markdown, matching this shape exactly:
{"entries": [{"matchType": "tracked" | "untracked" | "general", "competitor": "<name or null for general>", "outcome": "won" | "lost", "reason": "<short factual reason, or null for tracked/untracked with none given>"}, ...]}`;

const EXTRACT_WIN_LOSS_SCHEMA = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          matchType: { type: "string", enum: ["tracked", "untracked", "general"] },
          competitor: { anyOf: [{ type: "string" }, { type: "null" }] },
          outcome: { type: "string", enum: ["won", "lost"] },
          reason: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["matchType", "competitor", "outcome", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["entries"],
  additionalProperties: false,
} as const;

// Caps input size so one call stays reasonably bounded — the import route
// chunks larger files into multiple calls sized comfortably under this
// (see CHUNK_ROWS there) rather than relying on this alone, and reports
// how many source lines were actually considered.
const WIN_LOSS_EXTRACT_LINE_LIMIT = 170;

export async function extractWinLossEntries(
  competitorNames: string[],
  rawText: string,
  accountId: string | null
): Promise<ExtractedWinLossEntry[]> {
  if (competitorNames.length === 0 || !rawText.trim()) return [];

  const truncated = rawText.split("\n").slice(0, WIN_LOSS_EXTRACT_LINE_LIMIT).join("\n");
  const userPrompt = `Tracked competitors: ${competitorNames.join(", ")}

Raw data:
${truncated}

Classify the rows.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096, // up to 170 rows/call can mean well over 100 entries
    system: cachedSystemPrompt(EXTRACT_WIN_LOSS_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: EXTRACT_WIN_LOSS_SCHEMA } },
    messages: [{ role: "user", content: userPrompt }],
  });
  recordLlmUsage(accountId, "extractWinLossEntries", message.model, message.usage);

  const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const competitorSet = new Set(competitorNames);
    const result: ExtractedWinLossEntry[] = [];
    for (const e of entries) {
      if (!e) continue;
      const outcome = e.outcome === "won" ? ("won" as const) : ("lost" as const);
      const reason = typeof e.reason === "string" && e.reason.trim() ? e.reason.trim() : null;
      const competitor = typeof e.competitor === "string" ? e.competitor.trim() : "";

      if (e.matchType === "tracked" && competitorSet.has(competitor)) {
        result.push({ matchType: "tracked", competitor, outcome, reason });
      } else if (e.matchType === "untracked" && competitor && !competitorSet.has(competitor)) {
        result.push({ matchType: "untracked", competitor, outcome, reason });
      } else if (e.matchType === "general" && reason) {
        result.push({ matchType: "general", competitor: null, outcome, reason });
      }
      // A "tracked" row whose competitor isn't actually in the tracked set
      // (or vice versa) is silently dropped rather than reclassified —
      // that mismatch means the model didn't follow instructions cleanly,
      // and guessing which bucket it "should" be in risks misattribution.
    }
    return result;
  } catch (err) {
    throw new Error(`Could not parse win/loss extraction response: ${text}`, { cause: err });
  }
}
