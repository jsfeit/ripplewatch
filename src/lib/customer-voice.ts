import type { Database } from "@/lib/supabase/types";

// "Voice of customer" — the account's own customers, not Ripplewatch's.
// NPS scores and open-ended asks (feature requests, complaints, praise)
// the account has collected from ITS customers, given the same
// structured-log treatment win/loss already has instead of a single
// free-text blob. Not marked server-only (unlike win-loss-import.ts):
// these are pure functions with no DB/secret access, the same reasoning
// momentum.ts stays plain so both server pages and client components can
// share one implementation.

export type NpsResponse = Pick<
  Database["public"]["Tables"]["account_nps_responses"]["Row"],
  "score" | "survey_date"
>;

export type NpsBucket = "promoter" | "passive" | "detractor";

// Standard NPS bucketing: 9-10 promoter, 7-8 passive, 0-6 detractor.
export function npsBucket(score: number): NpsBucket {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

// Standard NPS formula: %promoters - %detractors, rounded to a whole
// number (the conventional -100..100 scale, not a percentage). Null for
// an empty set — "no score yet" is a different thing from "a 0 score,"
// the same distinction Momentum's null-vs-Steady already draws.
export function computeNps(responses: { score: number }[]): number | null {
  if (responses.length === 0) return null;
  let promoters = 0;
  let detractors = 0;
  for (const r of responses) {
    const bucket = npsBucket(r.score);
    if (bucket === "promoter") promoters++;
    else if (bucket === "detractor") detractors++;
  }
  return Math.round(((promoters - detractors) / responses.length) * 100);
}

// Recent-vs-prior comparison windows, same shape as momentum.ts's
// WINDOW_DAYS — but wider (90, not 30): NPS is typically collected far
// less often than competitor signals, so a 30-day window would frequently
// have zero or one response and never show a meaningful trend.
export const NPS_WINDOW_DAYS = 90;

export type NpsSummary = {
  overallScore: number | null;
  overallCount: number;
  recentScore: number | null;
  recentCount: number;
  priorScore: number | null;
  priorCount: number;
  promoters: number;
  passives: number;
  detractors: number;
  latestSurveyDate: string | null;
};

export function summarizeNps(responses: NpsResponse[], now: Date = new Date()): NpsSummary {
  const recentStart = new Date(now);
  recentStart.setUTCDate(recentStart.getUTCDate() - NPS_WINDOW_DAYS);
  const priorStart = new Date(now);
  priorStart.setUTCDate(priorStart.getUTCDate() - NPS_WINDOW_DAYS * 2);

  const recent = responses.filter((r) => new Date(r.survey_date) >= recentStart && new Date(r.survey_date) <= now);
  const prior = responses.filter((r) => new Date(r.survey_date) >= priorStart && new Date(r.survey_date) < recentStart);

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let latestSurveyDate: string | null = null;
  for (const r of responses) {
    const bucket = npsBucket(r.score);
    if (bucket === "promoter") promoters++;
    else if (bucket === "passive") passives++;
    else detractors++;
    if (!latestSurveyDate || r.survey_date > latestSurveyDate) latestSurveyDate = r.survey_date;
  }

  return {
    overallScore: computeNps(responses),
    overallCount: responses.length,
    recentScore: computeNps(recent),
    recentCount: recent.length,
    priorScore: computeNps(prior),
    priorCount: prior.length,
    promoters,
    passives,
    detractors,
    latestSurveyDate,
  };
}

// --- CSV import: NPS is reliably columnar (every survey tool exports
// score/date/comment as named columns), so this parses columns directly
// rather than an LLM extraction pass the way win-loss's freeform reason
// text needs — cheaper, instant, and more reliable for data this
// structured. Recognizes common header names from the tools accounts are
// likely already using (Delighted, Typeform, Survicate, a plain HubSpot
// export) rather than requiring one exact format.

const SCORE_HEADERS = ["score", "nps", "nps score", "rating", "response"];
const DATE_HEADERS = ["date", "survey date", "response date", "created", "created at", "submitted", "timestamp"];
const REASON_HEADERS = ["reason", "comment", "comments", "feedback", "why", "open text", "open-end", "verbatim"];
const RESPONDENT_HEADERS = ["respondent", "email", "name", "customer", "contact"];

function parseCsvLine(line: string): string[] {
  // Minimal CSV split with quoted-field support — good enough for the
  // simple, machine-generated exports this targets (no embedded newlines
  // inside a quoted field, which a real CSV parser would need to handle
  // but a single-line survey-tool export never does in practice).
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

// Accepts a two-digit or ISO-ish date and normalizes to YYYY-MM-DD; falls
// back to today when a row has no parseable date rather than dropping the
// whole row, since the score itself is still real signal even undated.
function normalizeDate(raw: string): string {
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export type ParsedNpsRow = {
  score: number;
  survey_date: string;
  reason: string | null;
  respondent: string | null;
};

export type NpsCsvParseResult = {
  rows: ParsedNpsRow[];
  totalDataRows: number;
  skipped: number;
};

// Requires a header row with a recognizable score column — everything
// else (date/reason/respondent) is optional and falls back gracefully, but
// a file with no identifiable score column has nothing worth importing,
// so it returns zero rows rather than guessing which column is the score.
export function parseNpsCsv(rawText: string): NpsCsvParseResult {
  const lines = rawText.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], totalDataRows: 0, skipped: 0 };

  const headers = parseCsvLine(lines[0]);
  const scoreCol = findColumn(headers, SCORE_HEADERS);
  if (scoreCol === -1) return { rows: [], totalDataRows: 0, skipped: 0 };
  const dateCol = findColumn(headers, DATE_HEADERS);
  const reasonCol = findColumn(headers, REASON_HEADERS);
  const respondentCol = findColumn(headers, RESPONDENT_HEADERS);

  const dataLines = lines.slice(1);
  const rows: ParsedNpsRow[] = [];
  let skipped = 0;
  for (const line of dataLines) {
    const cells = parseCsvLine(line);
    const rawScore = cells[scoreCol];
    const score = Number.parseInt(rawScore, 10);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      skipped++;
      continue;
    }
    rows.push({
      score,
      survey_date: dateCol !== -1 ? normalizeDate(cells[dateCol]) : new Date().toISOString().slice(0, 10),
      reason: reasonCol !== -1 && cells[reasonCol] ? cells[reasonCol] : null,
      respondent: respondentCol !== -1 && cells[respondentCol] ? cells[respondentCol] : null,
    });
  }

  return { rows, totalDataRows: dataLines.length, skipped };
}

// Customer asks are freeform (a support-ticket export, sales-call notes, a
// survey open-end) so there's no reliable column to key off beyond "does
// this look like a summary/feedback/request column" — falls back to
// treating every non-empty line as one ask when no such header is found,
// which is the common case (a plain list pasted in, one ask per line).
const ASK_HEADERS = ["summary", "ask", "request", "feedback", "feature", "idea", "note"];
const ASK_SOURCE_HEADERS = ["source", "channel", "via"];

export type ParsedAskRow = { summary: string; source: string | null };

export function parseAsksCsv(rawText: string): ParsedAskRow[] {
  const lines = rawText.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const summaryCol = findColumn(headers, ASK_HEADERS);
  const sourceCol = findColumn(headers, ASK_SOURCE_HEADERS);

  if (summaryCol === -1) {
    // No recognizable header at all — treat the whole file as a plain
    // list, one ask per line (including what would otherwise have been
    // treated as a header, since without a matched column there's no
    // reason to believe line 1 was special).
    return lines.map((l) => ({ summary: l.replace(/^"|"$/g, "").trim(), source: null })).filter((r) => r.summary);
  }

  return lines
    .slice(1)
    .map((line) => {
      const cells = parseCsvLine(line);
      return { summary: cells[summaryCol] ?? "", source: sourceCol !== -1 ? (cells[sourceCol] ?? null) : null };
    })
    .filter((r) => r.summary);
}
