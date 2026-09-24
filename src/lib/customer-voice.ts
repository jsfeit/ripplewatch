import type { Database } from "@/lib/supabase/types";

// "Voice of customer" — the account's own customers, not Ripplewatch's.
// One log, modeled directly on competitor_win_loss: a required summary
// (the feedback itself) plus an optional 0-10 NPS score, rather than two
// separate tables/forms for "a score" vs "an ask" — NPS is just one shape
// this can take, the same way "won" vs "lost" are just one field on a
// win/loss entry. Not marked server-only (unlike win-loss-import.ts):
// these are pure functions with no DB/secret access, same reasoning
// momentum.ts stays plain so both server pages and client components can
// share one implementation.

export type FeedbackEntry = Pick<
  Database["public"]["Tables"]["account_customer_feedback"]["Row"],
  "score" | "feedback_date"
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
export function computeNps(scores: number[]): number | null {
  if (scores.length === 0) return null;
  let promoters = 0;
  let detractors = 0;
  for (const score of scores) {
    const bucket = npsBucket(score);
    if (bucket === "promoter") promoters++;
    else if (bucket === "detractor") detractors++;
  }
  return Math.round(((promoters - detractors) / scores.length) * 100);
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

// Only entries that actually carry a score count toward NPS — a plain ask
// (score null) is real feedback but has nothing for this specific
// calculation to bucket.
export function summarizeNps(entries: FeedbackEntry[], now: Date = new Date()): NpsSummary {
  const scored = entries.filter((e): e is FeedbackEntry & { score: number } => e.score !== null);
  const recentStart = new Date(now);
  recentStart.setUTCDate(recentStart.getUTCDate() - NPS_WINDOW_DAYS);
  const priorStart = new Date(now);
  priorStart.setUTCDate(priorStart.getUTCDate() - NPS_WINDOW_DAYS * 2);

  const recent = scored.filter((e) => new Date(e.feedback_date) >= recentStart && new Date(e.feedback_date) <= now);
  const prior = scored.filter((e) => new Date(e.feedback_date) >= priorStart && new Date(e.feedback_date) < recentStart);

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let latestSurveyDate: string | null = null;
  for (const e of scored) {
    const bucket = npsBucket(e.score);
    if (bucket === "promoter") promoters++;
    else if (bucket === "passive") passives++;
    else detractors++;
    if (!latestSurveyDate || e.feedback_date > latestSurveyDate) latestSurveyDate = e.feedback_date;
  }

  return {
    overallScore: computeNps(scored.map((e) => e.score)),
    overallCount: scored.length,
    recentScore: computeNps(recent.map((e) => e.score)),
    recentCount: recent.length,
    priorScore: computeNps(prior.map((e) => e.score)),
    priorCount: prior.length,
    promoters,
    passives,
    detractors,
    latestSurveyDate,
  };
}

// --- CSV import: one parser for the whole feedback log — recognizes an
// optional score column (present for an NPS-style export) alongside a
// summary/reason column (present for an ask/feedback export, or a survey's
// open-end comment). A row needs at least one of the two to be worth
// importing; whichever columns exist, exist, and the row carries whatever
// it has, same "NPS is just an example" shape as everything else here.

const SCORE_HEADERS = ["score", "nps", "nps score", "rating", "response"];
const DATE_HEADERS = ["date", "survey date", "response date", "created", "created at", "submitted", "timestamp"];
const SUMMARY_HEADERS = ["reason", "comment", "comments", "feedback", "why", "open text", "open-end", "verbatim", "summary", "ask", "request", "feature", "idea", "note"];
const RESPONDENT_HEADERS = ["respondent", "email", "name", "customer", "contact"];
const SOURCE_HEADERS = ["source", "channel", "via"];

function parseCsvLine(line: string): string[] {
  // Minimal CSV split with quoted-field support — good enough for the
  // simple, machine-generated exports this targets (no embedded newlines
  // inside a quoted field, which a single-line survey-tool export never
  // has in practice).
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
// whole row, since the rest of the row is still real signal even undated.
function normalizeDate(raw: string): string {
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export type ParsedFeedbackRow = {
  summary: string;
  score: number | null;
  feedback_date: string;
  respondent: string | null;
  source: string | null;
};

export type FeedbackCsvParseResult = {
  rows: ParsedFeedbackRow[];
  totalDataRows: number;
  skipped: number;
};

// Requires a header row with a recognizable score OR summary column —
// everything else is optional. totalDataRows always reflects the real row
// count even when neither column is found — it's what the caller uses to
// tell "this file is genuinely empty" apart from "this file has rows but
// no recognizable column" (worth an LLM pass instead — see the import
// route's fallback), and conflating the two into a blanket 0 would make
// the route reject the exact freeform files that fallback exists for
// before ever attempting it.
export function parseFeedbackCsv(rawText: string): FeedbackCsvParseResult {
  const lines = rawText.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], totalDataRows: 0, skipped: 0 };

  const totalDataRows = lines.length - 1;
  const headers = parseCsvLine(lines[0]);
  const scoreCol = findColumn(headers, SCORE_HEADERS);
  const summaryCol = findColumn(headers, SUMMARY_HEADERS);
  if (scoreCol === -1 && summaryCol === -1) return { rows: [], totalDataRows, skipped: 0 };

  const dateCol = findColumn(headers, DATE_HEADERS);
  const respondentCol = findColumn(headers, RESPONDENT_HEADERS);
  const sourceCol = findColumn(headers, SOURCE_HEADERS);

  const dataLines = lines.slice(1);
  const rows: ParsedFeedbackRow[] = [];
  let skipped = 0;
  for (const line of dataLines) {
    const cells = parseCsvLine(line);

    let score: number | null = null;
    if (scoreCol !== -1) {
      const parsed = Number.parseInt(cells[scoreCol], 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) score = parsed;
    }
    const summary = summaryCol !== -1 ? cells[summaryCol] : "";

    if (score === null && !summary) {
      skipped++;
      continue;
    }

    rows.push({
      summary: summary || `NPS response (score ${score})`,
      score,
      feedback_date: dateCol !== -1 ? normalizeDate(cells[dateCol]) : new Date().toISOString().slice(0, 10),
      respondent: respondentCol !== -1 && cells[respondentCol] ? cells[respondentCol] : null,
      source: sourceCol !== -1 && cells[sourceCol] ? cells[sourceCol] : null,
    });
  }

  return { rows, totalDataRows, skipped };
}

// No-header fallback: a genuinely plain list (no commas anywhere) is
// treated as one ask per line, same as before consolidation. Anything
// CSV-shaped with no recognized column is left for the LLM-extraction
// fallback in the import route instead of guessing which column matters.
export function parsePlainFeedbackList(rawText: string): ParsedFeedbackRow[] {
  const lines = rawText.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
  if (lines.length === 0 || lines.some((l) => l.includes(","))) return [];
  return lines.map((l) => ({
    summary: l.trim(),
    score: null,
    feedback_date: new Date().toISOString().slice(0, 10),
    respondent: null,
    source: null,
  }));
}
