import "server-only";
import { cachedSystemPrompt, createMessage } from "@/lib/anthropic";
import { recordLlmUsage } from "@/lib/usage";
import { DEAL_THEMES, isDealTheme, type DealTheme } from "@/lib/deal-themes";
import { heuristicMapping, type DealColumnMapping, type DealTable } from "@/lib/deal-csv";

const MODEL = "claude-sonnet-5";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Which column is which
// ---------------------------------------------------------------------------

const PROFILE_SYSTEM_PROMPT = `You map the columns of a sales deal export (CRM report, spreadsheet, anything) onto a fixed set of roles. You are given the column names, a few sample rows, and the distinct values of columns that have few distinct values.

Roles (use null when no column fits; copy column names EXACTLY as given):
- closeDate: when the deal closed or was decided. Prefer a close/decision/won/lost date over a created date. If only a created date exists, use it.
- amount: deal value (ARR, ACV, amount, revenue).
- outcome: the column that says whether the deal was won or lost (Stage, Status, Outcome, Result). Open or in-progress deals are not an outcome.
- competitor: the competing company that won (or was beaten), if the data names one.
- reason: ALL columns that explain WHY the deal was won or lost (loss reason, win reason, notes, comments). Zero or more.
- dealName, dealId, owner, segment.
- dateOrder: "ymd", "mdy" or "dmy", judged from the sample dates. Use "mdy" when the dates are ambiguous and look US-style.
- outcomeValues: for every distinct value of the outcome column, whether it means "won", "lost", "churned" or "ignore" (open, in progress, unknown, anything not a closed result).

Respond with JSON only, matching the schema.`;

const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    closeDate: { anyOf: [{ type: "string" }, { type: "null" }] },
    amount: { anyOf: [{ type: "string" }, { type: "null" }] },
    outcome: { anyOf: [{ type: "string" }, { type: "null" }] },
    competitor: { anyOf: [{ type: "string" }, { type: "null" }] },
    reason: { type: "array", items: { type: "string" } },
    dealName: { anyOf: [{ type: "string" }, { type: "null" }] },
    dealId: { anyOf: [{ type: "string" }, { type: "null" }] },
    owner: { anyOf: [{ type: "string" }, { type: "null" }] },
    segment: { anyOf: [{ type: "string" }, { type: "null" }] },
    dateOrder: { type: "string", enum: ["ymd", "mdy", "dmy"] },
    outcomeValues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          outcome: { type: "string", enum: ["won", "lost", "churned", "ignore"] },
        },
        required: ["value", "outcome"],
        additionalProperties: false,
      },
    },
  },
  required: ["closeDate", "amount", "outcome", "competitor", "reason", "dealName", "dealId", "owner", "segment", "dateOrder", "outcomeValues"],
  additionalProperties: false,
} as const;

export async function profileDealColumns(table: DealTable, accountId: string | null): Promise<DealColumnMapping> {
  const fallback = heuristicMapping(table);
  const sample = table.rows.slice(0, 8).map((r) => Object.fromEntries(table.header.map((h, i) => [h, (r[i] ?? "").slice(0, 160)])));
  const distinct: Record<string, string[]> = {};
  table.header.forEach((h, i) => {
    const values = new Set<string>();
    for (const r of table.rows) {
      const v = (r[i] ?? "").trim();
      if (v) values.add(v.slice(0, 80));
      if (values.size > 25) return;
    }
    if (values.size > 0 && values.size <= 25) distinct[h] = [...values];
  });

  try {
    const message = await createMessage({
      model: MODEL,
      max_tokens: 2048,
      system: cachedSystemPrompt(PROFILE_SYSTEM_PROMPT),
      output_config: { format: { type: "json_schema", schema: PROFILE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: JSON.stringify({ columns: table.header, sampleRows: sample, distinctValues: distinct, totalRows: table.rows.length }),
        },
      ],
    });
    recordLlmUsage(accountId, "profileDealColumns", message.model, message.usage);
    const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
    const parsed = parseJson(text) as Record<string, unknown> | null;
    if (!parsed) return fallback;

    const valid = (v: unknown): string | null => (typeof v === "string" && table.header.includes(v) ? v : null);
    const outcomeValues: DealColumnMapping["outcomeValues"] = {};
    for (const item of Array.isArray(parsed.outcomeValues) ? parsed.outcomeValues : []) {
      const value = typeof item?.value === "string" ? item.value.trim().toLowerCase() : "";
      if (value && ["won", "lost", "churned", "ignore"].includes(item.outcome)) outcomeValues[value] = item.outcome;
    }
    const mapping: DealColumnMapping = {
      closeDate: valid(parsed.closeDate),
      amount: valid(parsed.amount),
      outcome: valid(parsed.outcome),
      competitor: valid(parsed.competitor),
      reason: (Array.isArray(parsed.reason) ? parsed.reason : []).map(valid).filter((c): c is string => Boolean(c)),
      dealName: valid(parsed.dealName),
      dealId: valid(parsed.dealId),
      owner: valid(parsed.owner),
      segment: valid(parsed.segment),
      dateOrder: parsed.dateOrder === "ymd" || parsed.dateOrder === "dmy" ? parsed.dateOrder : "mdy",
      outcomeValues,
    };
    // No usable outcome column means nothing can be imported; fall back to header guessing instead.
    if (!mapping.outcome || Object.keys(mapping.outcomeValues).length === 0) return fallback;
    return mapping;
  } catch (err) {
    console.error("profileDealColumns failed, using header guess:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// 2. What the reasons and competitor names mean
// ---------------------------------------------------------------------------

export type DealReasonInput = { key: string; outcome: "won" | "lost" | "churned"; competitor: string | null; reason: string | null };

export type DealReadResult = {
  key: string;
  // "tracked" is only returned for a name in the tracked list, copied exactly. "none" is a deal where
  // no competing company is named (no decision, built in-house, went dark, blank).
  competitorKind: "tracked" | "untracked" | "none";
  competitor: string | null;
  themes: DealTheme[];
  // The specific thing, in a few words: "reporting", "SSO", "annual contract", "Salesforce sync".
  detail: string | null;
};

const CLASSIFY_SYSTEM_PROMPT = `You read why sales deals were won or lost. For each item you get an outcome, an optional competitor name as written in the source, and an optional free-text reason.

For every item return:
- competitorKind: "tracked" if the competitor names one of the TRACKED competitors (copy the tracked name exactly; spelling or capitalization differences are fine, but never force a fuzzy match to a different company); "untracked" if it names a real, specific competing company that is not tracked (use the company's proper name); "none" if no competing company is named. "No decision", "none", "status quo", "in-house", "unknown", "n/a" and blanks are NOT competitors.
- themes: one to three of ${DEAL_THEMES.join(", ")}. Pick what the reason actually says. "No decision" or a deal that went dark is no_decision; staying with the current tool or building it themselves is status_quo; budget, timing or procurement is timing_budget; a champion leaving is champion_change. If the reason is empty, return ["other"].
- detail: the specific thing in a few words when the reason names one (a missing feature, an integration, a pricing structure, a certification). Otherwise null. Lowercase, no punctuation.

Never invent a reason or competitor that is not in the item. Return one result per item, same keys.`;

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          competitorKind: { type: "string", enum: ["tracked", "untracked", "none"] },
          competitor: { anyOf: [{ type: "string" }, { type: "null" }] },
          themes: { type: "array", items: { type: "string", enum: [...DEAL_THEMES] } },
          detail: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["key", "competitorKind", "competitor", "themes", "detail"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

export const CLASSIFY_BATCH = 40;

export async function classifyDealReasons(
  trackedNames: string[],
  items: DealReasonInput[],
  accountId: string | null
): Promise<DealReadResult[]> {
  if (items.length === 0) return [];
  const message = await createMessage({
    model: MODEL,
    max_tokens: 8192,
    system: cachedSystemPrompt(CLASSIFY_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: CLASSIFY_SCHEMA } },
    messages: [{ role: "user", content: JSON.stringify({ tracked: trackedNames, items }) }],
  });
  recordLlmUsage(accountId, "classifyDealReasons", message.model, message.usage);
  const parsed = parseJson(message.content.find((b) => b.type === "text")?.text ?? "{}") as { results?: unknown } | null;
  const tracked = new Set(trackedNames);
  const out: DealReadResult[] = [];
  for (const r of Array.isArray(parsed?.results) ? parsed.results : []) {
    if (!r || typeof r.key !== "string") continue;
    const competitor = typeof r.competitor === "string" && r.competitor.trim() ? r.competitor.trim() : null;
    let kind: DealReadResult["competitorKind"] = r.competitorKind === "tracked" || r.competitorKind === "untracked" ? r.competitorKind : "none";
    // A "tracked" claim for a name that is not actually tracked is reclassified, never trusted.
    if (kind === "tracked" && (!competitor || !tracked.has(competitor))) kind = competitor ? "untracked" : "none";
    if (kind === "untracked" && competitor && tracked.has(competitor)) kind = "tracked";
    if (!competitor) kind = "none";
    const themes = (Array.isArray(r.themes) ? r.themes : []).filter((t: unknown): t is DealTheme => typeof t === "string" && isDealTheme(t));
    out.push({
      key: r.key,
      competitorKind: kind,
      competitor: kind === "none" ? null : competitor,
      themes: themes.length ? themes.slice(0, 3) : ["other"],
      detail: typeof r.detail === "string" && r.detail.trim() ? r.detail.trim().toLowerCase().slice(0, 80) : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Free-form context notes
// ---------------------------------------------------------------------------

export type ExtractedContextNote = {
  kind: "roadmap" | "pricing" | "customer" | "sales" | "market" | "other";
  status: "idea" | "planned" | "in_progress" | "shipped" | null;
  productAreas: string[];
  themes: DealTheme[];
  // YYYY-MM-DD when the note says when something ships, launched or was decided.
  expectedOn: string | null;
};

const CONTEXT_SYSTEM_PROMPT = `You read one free-form note from a software team and tag it so it can be lined up against lost-deal reasons and competitor moves. The note may be about what they are building, pricing, a customer comment, a sales-call insight, or the market.

Return:
- kind: roadmap (something they are building or shipping), pricing (their own pricing or packaging), customer (what a customer said or needs), sales (a sales insight or objection), market (something about the market or competitors), other.
- status: for roadmap notes only: idea, planned, in_progress or shipped. Otherwise null.
- productAreas: the specific product areas or capabilities named, lowercase, a few words each ("reporting", "sso", "salesforce sync"). Empty if none.
- themes: zero to three of ${DEAL_THEMES.join(", ")} this note speaks to (for example a feature that closes a gap is missing_feature; a pricing change is price).
- expectedOn: a date YYYY-MM-DD only if the note states or clearly implies when it ships or happened, given today's date. Otherwise null.

Do not add facts that are not in the note.`;

const CONTEXT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["roadmap", "pricing", "customer", "sales", "market", "other"] },
    status: { anyOf: [{ type: "string", enum: ["idea", "planned", "in_progress", "shipped"] }, { type: "null" }] },
    productAreas: { type: "array", items: { type: "string" } },
    themes: { type: "array", items: { type: "string", enum: [...DEAL_THEMES] } },
    expectedOn: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["kind", "status", "productAreas", "themes", "expectedOn"],
  additionalProperties: false,
} as const;

export async function extractContextNote(body: string, today: string, accountId: string | null): Promise<ExtractedContextNote> {
  const fallback: ExtractedContextNote = { kind: "other", status: null, productAreas: [], themes: [], expectedOn: null };
  try {
    const message = await createMessage({
      model: MODEL,
      max_tokens: 1024,
      system: cachedSystemPrompt(CONTEXT_SYSTEM_PROMPT),
      output_config: { format: { type: "json_schema", schema: CONTEXT_SCHEMA } },
      messages: [{ role: "user", content: `Today: ${today}\n\nNote:\n${body.slice(0, 4000)}` }],
    });
    recordLlmUsage(accountId, "extractContextNote", message.model, message.usage);
    const p = parseJson(message.content.find((b) => b.type === "text")?.text ?? "{}") as Record<string, unknown> | null;
    if (!p) return fallback;
    const expectedOn = typeof p.expectedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.expectedOn) ? p.expectedOn : null;
    return {
      kind: (["roadmap", "pricing", "customer", "sales", "market"].includes(p.kind as string) ? p.kind : "other") as ExtractedContextNote["kind"],
      status: (["idea", "planned", "in_progress", "shipped"].includes(p.status as string) ? p.status : null) as ExtractedContextNote["status"],
      productAreas: (Array.isArray(p.productAreas) ? p.productAreas : [])
        .filter((a): a is string => typeof a === "string" && a.trim() !== "")
        .map((a) => a.trim().toLowerCase().slice(0, 60))
        .slice(0, 8),
      themes: (Array.isArray(p.themes) ? p.themes : []).filter((t): t is DealTheme => typeof t === "string" && isDealTheme(t)).slice(0, 3),
      expectedOn,
    };
  } catch (err) {
    console.error("extractContextNote failed:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// 4. Findings: what the computed facts mean
// ---------------------------------------------------------------------------

export type ImpactFinding = {
  headline: string;
  explanation: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
  action: string;
  competitors: string[];
  themes: string[];
};

const IMPACT_SYSTEM_PROMPT = `You are a competitive intelligence analyst for a software company. You are given FACTS about their closed deals, competitor activity and internal notes. The numbers were computed by code; you only interpret them.

Write at most five findings, most important first. Each has:
- headline: one plain sentence a sales or product leader would act on.
- explanation: two or three sentences on what is happening and why it likely matters. Use hedged language ("lines up with", "may be") whenever the link is timing alone. Never claim a competitor won a specific deal unless the facts say the deal named that competitor.
- evidence: two to four short statements, each using ONLY numbers, dates and names that appear in the facts.
- confidence: high only when the deals name the competitor or the pattern is large and consistent; medium for a clear pattern whose cause is timing; low for thin data.
- action: one concrete next step (a talk track, a roadmap call, a pricing check, a deal to review).
- competitors, themes: the ones involved.

Rules:
- Many losses never name who won, so lead with the reasons (what is costing deals) and use competitor moves as candidate explanations.
- If an internal note (something being built) lines up with a loss theme, say how many recent losses it could address and when it ships; if the ship date is later than now, say what to do until then.
- If coverage.level is "thin" or "building", say so in the first finding and name what more data would unlock (more closed deals, a longer date range, reasons filled in). Do not pad with speculation.
- Never invent a number. If the facts do not support a finding, write fewer findings.`;

const IMPACT_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          headline: { type: "string" },
          explanation: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          action: { type: "string" },
          competitors: { type: "array", items: { type: "string" } },
          themes: { type: "array", items: { type: "string" } },
        },
        required: ["headline", "explanation", "evidence", "confidence", "action", "competitors", "themes"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings"],
  additionalProperties: false,
} as const;

export async function generateImpactFindings(facts: unknown, accountId: string | null): Promise<ImpactFinding[]> {
  const message = await createMessage({
    model: MODEL,
    max_tokens: 4096,
    system: cachedSystemPrompt(IMPACT_SYSTEM_PROMPT),
    output_config: { format: { type: "json_schema", schema: IMPACT_SCHEMA } },
    messages: [{ role: "user", content: `FACTS:\n${JSON.stringify(facts)}` }],
  });
  recordLlmUsage(accountId, "generateImpactFindings", message.model, message.usage);
  const parsed = parseJson(message.content.find((b) => b.type === "text")?.text ?? "{}") as { findings?: unknown } | null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const out: ImpactFinding[] = [];
  for (const f of Array.isArray(parsed?.findings) ? parsed.findings : []) {
    const headline = str(f?.headline);
    if (!headline) continue;
    out.push({
      headline,
      explanation: str(f.explanation),
      evidence: list(f.evidence).slice(0, 5),
      confidence: f.confidence === "high" || f.confidence === "low" ? f.confidence : "medium",
      action: str(f.action),
      competitors: list(f.competitors),
      themes: list(f.themes),
    });
  }
  return out.slice(0, 5);
}
