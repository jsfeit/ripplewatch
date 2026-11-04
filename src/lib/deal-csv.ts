import { createHash } from "node:crypto";

// Turns an arbitrary deal export into canonical deals without caring what the columns are called.
// Parsing, dates, amounts and ids are deterministic here; only "which column is which" and "what do
// the reason words mean" involve a model (see deal-ingest.ts). That keeps dates and money exact and
// keeps model cost proportional to the number of distinct reasons, not the number of rows.

export type DealTable = { header: string[]; rows: string[][]; delimiter: string };

export type DateOrder = "ymd" | "mdy" | "dmy";

export type DealColumnMapping = {
  closeDate: string | null;
  amount: string | null;
  outcome: string | null;
  competitor: string | null;
  // Columns that hold the why (loss reason, notes, comments). Joined in the order given.
  reason: string[];
  dealName: string | null;
  dealId: string | null;
  owner: string | null;
  segment: string | null;
  dateOrder: DateOrder;
  // Raw outcome cell (lowercased) -> outcome. Anything missing or "ignore" is skipped, e.g. open deals.
  outcomeValues: Record<string, "won" | "lost" | "churned" | "ignore">;
};

export type CanonicalDeal = {
  rowIndex: number;
  closedOn: string | null;
  amount: number | null;
  outcome: "won" | "lost" | "churned";
  competitorRaw: string | null;
  reasonText: string | null;
  dealName: string | null;
  dealRef: string;
  owner: string | null;
  segment: string | null;
  raw: Record<string, string>;
};

export type MappingReport = {
  totalRows: number;
  usable: number;
  skippedNoOutcome: number;
  skippedOpen: number;
  withDate: number;
  withReason: number;
  withCompetitor: number;
  earliest: string | null;
  latest: string | null;
};

const DELIMITERS = [",", "\t", ";", "|"];

function detectDelimiter(headerLine: string): string {
  let best = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

// RFC 4180 style: quoted fields, doubled quotes, newlines inside quotes, CRLF.
export function parseDealTable(text: string): DealTable {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((v) => v.trim() !== "")) records.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  record.push(field);
  if (record.some((v) => v.trim() !== "")) records.push(record);

  const [header = [], ...rows] = records;
  return { header: header.map((h) => h.trim()), rows, delimiter };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseDealDate(value: string, order: DateOrder): string | null {
  const v = value.trim();
  if (!v) return null;

  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);

  // Excel serial dates (days since 1899-12-30).
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 86400000);
    return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T\s].*)?$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    // A part above 12 can only be the day, whatever order the file mostly uses.
    if (a > 12) return isoDate(y, b, a);
    if (b > 12) return isoDate(y, a, b);
    return order === "dmy" ? isoDate(y, b, a) : isoDate(y, a, b);
  }

  m = v.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return mi >= 0 ? isoDate(+m[3], mi + 1, +m[2]) : null;
  }
  m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return mi >= 0 ? isoDate(+m[3], mi + 1, +m[1]) : null;
  }
  return null;
}

// Looks at every unambiguous date in a column to decide day-first vs month-first for the rest.
export function guessDateOrder(values: string[]): DateOrder {
  let mdy = 0;
  let dmy = 0;
  for (const raw of values) {
    const m = raw.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (!m) {
      if (/^\d{4}[-/.]/.test(raw.trim())) return "ymd";
      continue;
    }
    if (+m[1] > 12) dmy++;
    else if (+m[2] > 12) mdy++;
  }
  return dmy > mdy ? "dmy" : "mdy";
}

export function parseAmount(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const m = v.match(/^\(?\s*[$€£]?\s*(-?[\d,]+(?:\.\d+)?)\s*([kKmM])?\s*\)?$/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  if (m[2]?.toLowerCase() === "k") n *= 1000;
  if (m[2]?.toLowerCase() === "m") n *= 1_000_000;
  return n;
}

// Best effort when no model is available or its answer is unusable: header words only.
export function heuristicMapping(table: DealTable): DealColumnMapping {
  const find = (re: RegExp) => table.header.find((h) => re.test(h)) ?? null;
  const reasonCols = table.header.filter((h) => /reason|why|note|comment|feedback|detail|descript/i.test(h));
  const dateCol = find(/close.*date|closed|date.*clos|won.*date|decision.*date|^date$/i) ?? find(/date/i);
  const outcomeCol = find(/outcome|result|status|stage|won.?lost|win.?loss/i);
  const order = guessDateOrder(
    dateCol ? table.rows.map((r) => r[table.header.indexOf(dateCol)] ?? "").slice(0, 200) : []
  );

  const outcomeValues: DealColumnMapping["outcomeValues"] = {};
  if (outcomeCol) {
    const idx = table.header.indexOf(outcomeCol);
    for (const r of table.rows) {
      const raw = (r[idx] ?? "").trim().toLowerCase();
      if (!raw || raw in outcomeValues) continue;
      outcomeValues[raw] = /churn/.test(raw) ? "churned" : /lost|loss|declin|closed.?lost/.test(raw) ? "lost" : /won|win|closed.?won|signed/.test(raw) ? "won" : "ignore";
    }
  }

  return {
    closeDate: dateCol,
    amount: find(/amount|value|arr|acv|mrr|revenue|price/i),
    outcome: outcomeCol,
    competitor: find(/competitor|vendor|chosen|selected|went.?with|lost.?to|incumbent/i),
    reason: reasonCols,
    dealName: find(/deal.?name|opportunity|account.?name|company|customer|^name$/i),
    dealId: find(/(deal|opportunity|record).*id|^id$/i),
    owner: find(/owner|rep|ae\b|salesperson/i),
    segment: find(/segment|industry|size|tier|region/i),
    dateOrder: order,
    outcomeValues,
  };
}

function cell(row: string[], header: string[], col: string | null): string {
  if (!col) return "";
  const idx = header.indexOf(col);
  return idx >= 0 ? (row[idx] ?? "").trim() : "";
}

// Applies a mapping to every row. Returns canonical deals plus a report the user can check before
// anything is written ("1,204 rows, 1,150 usable, dates on 98%").
export function applyDealMapping(
  table: DealTable,
  mapping: DealColumnMapping
): { deals: CanonicalDeal[]; report: MappingReport } {
  const deals: CanonicalDeal[] = [];
  const report: MappingReport = {
    totalRows: table.rows.length,
    usable: 0,
    skippedNoOutcome: 0,
    skippedOpen: 0,
    withDate: 0,
    withReason: 0,
    withCompetitor: 0,
    earliest: null,
    latest: null,
  };
  const seenRefs = new Map<string, number>();

  table.rows.forEach((row, rowIndex) => {
    const outcomeRaw = cell(row, table.header, mapping.outcome).toLowerCase();
    const mapped = outcomeRaw ? mapping.outcomeValues[outcomeRaw] : undefined;
    if (!mapped) {
      report.skippedNoOutcome++;
      return;
    }
    if (mapped === "ignore") {
      report.skippedOpen++;
      return;
    }

    const closedOn = mapping.closeDate ? parseDealDate(cell(row, table.header, mapping.closeDate), mapping.dateOrder) : null;
    const amountRaw = cell(row, table.header, mapping.amount);
    const amount = amountRaw ? parseAmount(amountRaw) : null;
    const reasonParts = mapping.reason.map((c) => cell(row, table.header, c)).filter(Boolean);
    const reasonText = reasonParts.length ? reasonParts.join(" | ").slice(0, 1000) : null;
    const competitorRaw = cell(row, table.header, mapping.competitor) || null;
    const dealName = cell(row, table.header, mapping.dealName) || null;
    const idCell = cell(row, table.header, mapping.dealId);

    const raw: Record<string, string> = {};
    table.header.forEach((h, i) => {
      if (h && row[i] !== undefined && row[i].trim() !== "") raw[h] = row[i].trim().slice(0, 500);
    });

    // A real deal id makes a re-import update the same deal. Without one, a hash of what identifies
    // the deal does the same job; an identical row appearing twice in one file gets a counter so two
    // genuinely separate deals are not merged.
    const base = idCell
      ? `id:${idCell}`
      : "h:" +
        createHash("sha1")
          .update([closedOn ?? "", amount ?? "", dealName ?? "", reasonText ?? "", competitorRaw ?? "", mapped].join("\u0001"))
          .digest("hex")
          .slice(0, 20);
    const n = (seenRefs.get(base) ?? 0) + 1;
    seenRefs.set(base, n);

    deals.push({
      rowIndex,
      closedOn,
      amount,
      outcome: mapped,
      competitorRaw,
      reasonText,
      dealName,
      dealRef: n === 1 ? base : `${base}#${n}`,
      owner: cell(row, table.header, mapping.owner) || null,
      segment: cell(row, table.header, mapping.segment) || null,
      raw,
    });

    report.usable++;
    if (closedOn) {
      report.withDate++;
      if (!report.earliest || closedOn < report.earliest) report.earliest = closedOn;
      if (!report.latest || closedOn > report.latest) report.latest = closedOn;
    }
    if (reasonText) report.withReason++;
    if (competitorRaw) report.withCompetitor++;
  });

  return { deals, report };
}
