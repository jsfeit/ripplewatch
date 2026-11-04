import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  applyDealMapping,
  parseDealTable,
  type CanonicalDeal,
  type DealColumnMapping,
  type DealTable,
  type MappingReport,
} from "@/lib/deal-csv";
import { CLASSIFY_BATCH, classifyDealReasons, profileDealColumns, type DealReadResult } from "@/lib/deal-llm";
import { appendDealNotes, suggestUntrackedCompetitors, type ApplyResult } from "@/lib/win-loss-import";
import { computeDealCoverage, type DealCoverage } from "@/lib/deal-coverage";
import { mapWithConcurrency } from "@/lib/crawl";
import { loadAllDeals } from "@/lib/deal-store";

type Admin = SupabaseClient<Database>;

// Bounds model cost and request time on a pathological file. The cost is per DISTINCT reason, not per
// row, so this is generous: a 5,000-row export usually has a few hundred distinct reasons.
export const MAX_DEAL_ROWS = 5000;
const CLASSIFY_CONCURRENCY = 6;
const UPSERT_CHUNK = 200;

export type DealImportPreview = {
  mapping: DealColumnMapping;
  report: MappingReport;
  columns: string[];
  sample: { closedOn: string | null; outcome: string; competitor: string | null; reason: string | null; amount: number | null; dealName: string | null }[];
  truncated: boolean;
};

export type DealImportSummary = ApplyResult & {
  rowsConsidered: number;
  totalRows: number;
  truncated: boolean;
  updated: number;
  datedPct: number;
  coverage: DealCoverage;
  importId: string | null;
};

function readTable(text: string): { table: DealTable; truncated: boolean } {
  const table = parseDealTable(text);
  if (table.rows.length > MAX_DEAL_ROWS) {
    return { table: { ...table, rows: table.rows.slice(0, MAX_DEAL_ROWS) }, truncated: true };
  }
  return { table, truncated: false };
}

// Step 1 of an import: work out what the columns are and show what would be read, writing nothing.
export async function previewDealImport(text: string, accountId: string | null): Promise<DealImportPreview | { error: string }> {
  const { table, truncated } = readTable(text);
  if (table.header.length < 2 || table.rows.length === 0) {
    return { error: "That did not look like a table with a header row and at least one deal." };
  }
  const mapping = await profileDealColumns(table, accountId);
  return buildPreview(table, mapping, truncated);
}

export function buildPreview(table: DealTable, mapping: DealColumnMapping, truncated: boolean): DealImportPreview {
  const { deals, report } = applyDealMapping(table, mapping);
  return {
    mapping,
    report,
    columns: table.header,
    sample: deals.slice(0, 6).map((d) => ({
      closedOn: d.closedOn,
      outcome: d.outcome,
      competitor: d.competitorRaw,
      reason: d.reasonText,
      amount: d.amount,
      dealName: d.dealName,
    })),
    truncated,
  };
}

function classifyKey(d: CanonicalDeal): string {
  return `${d.outcome}|${(d.competitorRaw ?? "").toLowerCase()}|${(d.reasonText ?? "").toLowerCase()}`;
}

// Reads each DISTINCT (outcome, competitor, reason) once and fans the answer back out to every deal
// that shares it. A reason column repeats heavily, so this is the difference between thousands of
// model reads and a few hundred.
async function readDeals(
  deals: CanonicalDeal[],
  trackedNames: string[],
  accountId: string
): Promise<Map<string, DealReadResult>> {
  const unique = new Map<string, CanonicalDeal>();
  for (const d of deals) {
    if (!d.competitorRaw && !d.reasonText) continue; // nothing to read: stays a dated, un-themed outcome
    const key = classifyKey(d);
    if (!unique.has(key)) unique.set(key, d);
  }
  const items = [...unique.entries()].map(([key, d]) => ({
    key,
    outcome: d.outcome,
    competitor: d.competitorRaw,
    reason: d.reasonText,
  }));
  const batches: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += CLASSIFY_BATCH) batches.push(items.slice(i, i + CLASSIFY_BATCH));

  const results = await mapWithConcurrency(batches, CLASSIFY_CONCURRENCY, (batch) =>
    classifyDealReasons(trackedNames, batch, accountId).catch((err) => {
      console.error("deal import: classification batch failed", err);
      return [] as DealReadResult[];
    })
  );
  return new Map(results.flat().map((r) => [r.key, r]));
}

// Step 2: read every deal and write it. Idempotent: a deal that is already there (same CRM id, or the
// same date, amount, name, reason and competitor) is updated in place, so uploading an overlapping or
// repeated export never double counts.
export async function commitDealImport(
  supabase: Admin,
  accountId: string,
  userId: string | null,
  text: string,
  mapping: DealColumnMapping,
  meta: { source: string; filename?: string | null }
): Promise<DealImportSummary> {
  const { table, truncated } = readTable(text);
  const { deals, report } = applyDealMapping(table, mapping);

  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);
  const tracked = competitors ?? [];
  const idByName = new Map(tracked.map((c) => [c.name, c.id]));

  const reads = await readDeals(deals, tracked.map((c) => c.name), accountId);

  const { data: importRow } = await supabase
    .from("win_loss_imports")
    .insert({
      account_id: accountId,
      source: meta.source,
      filename: meta.filename ?? null,
      row_count: report.totalRows,
      imported_count: 0,
      mapping: mapping as unknown as Record<string, unknown>,
      created_by: userId,
    })
    .select("id")
    .single();
  const importId = importRow?.id ?? null;

  const existingRefs = new Set<string>();
  const refs = deals.map((d) => d.dealRef);
  for (let i = 0; i < refs.length; i += 500) {
    const { data } = await supabase
      .from("competitor_win_loss")
      .select("deal_ref")
      .eq("account_id", accountId)
      .in("deal_ref", refs.slice(i, i + 500));
    for (const r of data ?? []) if (r.deal_ref) existingRefs.add(r.deal_ref);
  }

  const untracked: { competitor: string; outcome: "won" | "lost" | "churned" }[] = [];
  const rows: Database["public"]["Tables"]["competitor_win_loss"]["Insert"][] = deals.map((d) => {
    const read = reads.get(classifyKey(d));
    let competitorId: string | null = null;
    if (read?.competitorKind === "tracked" && read.competitor) competitorId = idByName.get(read.competitor) ?? null;
    if (read?.competitorKind === "untracked" && read.competitor) untracked.push({ competitor: read.competitor, outcome: d.outcome });
    return {
      account_id: accountId,
      competitor_id: competitorId,
      outcome: d.outcome,
      reason: d.reasonText,
      created_by: userId,
      closed_on: d.closedOn,
      amount: d.amount,
      deal_ref: d.dealRef,
      deal_name: d.dealName,
      owner: d.owner,
      segment: d.segment,
      source: meta.source,
      import_id: importId,
      raw: d.raw,
      reason_themes: read?.themes ?? [],
      reason_detail: read?.detail ?? null,
      competitor_raw: d.competitorRaw,
    };
  });

  let written = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase.from("competitor_win_loss").upsert(chunk, { onConflict: "account_id,deal_ref" });
    if (error) console.error("deal import: upsert failed", error.message);
    else written += chunk.length;
  }
  const updated = deals.filter((d) => existingRefs.has(d.dealRef)).length;
  const imported = Math.max(0, written - updated);

  if (importId) await supabase.from("win_loss_imports").update({ imported_count: written }).eq("id", importId);

  const { suggested, alreadySuggested } = await suggestUntrackedCompetitors(supabase, accountId, untracked);

  // Reasons with no competitor also feed the account's narrative deal notes, which scoring reads.
  const unattributed = (outcome: "won" | "lost") =>
    rows
      .filter((r, i) => r.outcome === outcome && !r.competitor_id && !existingRefs.has(deals[i].dealRef))
      .map((r) => r.reason as string)
      .filter(Boolean);
  const lostNotes = await appendDealNotes(supabase, accountId, "lost_deal_notes", unattributed("lost"));
  const wonNotes = await appendDealNotes(supabase, accountId, "won_deal_notes", unattributed("won"));

  const coverage = await loadDealCoverage(supabase, accountId);

  return {
    totalExtracted: deals.length,
    imported,
    skipped: updated,
    generalReasonsAdded: lostNotes.added.length,
    generalReasonsSkipped: lostNotes.skipped,
    generalWonReasonsAdded: wonNotes.added.length,
    generalWonReasonsSkipped: wonNotes.skipped,
    suggestedCompetitors: suggested,
    untrackedAlreadySuggested: alreadySuggested,
    rowsConsidered: table.rows.length,
    totalRows: truncated ? table.rows.length : report.totalRows,
    truncated,
    updated,
    datedPct: report.usable === 0 ? 0 : Math.round((report.withDate / report.usable) * 100),
    coverage,
    importId,
  };
}

// The one-shot path used by the assistant tool and the legacy import route: infer the mapping and
// commit without a confirmation step (the assistant already read the rows from the user's own tool).
export async function importDealText(
  supabase: Admin,
  accountId: string,
  userId: string | null,
  text: string,
  meta: { source: string; filename?: string | null }
): Promise<{ ok: true; result: DealImportSummary } | { ok: false; status: number; error: string }> {
  const { table } = readTable(text);
  if (table.header.length < 2 || table.rows.length === 0) {
    return { ok: false, status: 400, error: "That did not look like a table with a header row and at least one deal." };
  }
  const mapping = await profileDealColumns(table, accountId);
  const { report } = applyDealMapping(table, mapping);
  if (report.usable === 0) {
    return {
      ok: false,
      status: 400,
      error: "No closed won or lost deals were found. Check the file has a column saying whether each deal was won or lost.",
    };
  }
  return { ok: true, result: await commitDealImport(supabase, accountId, userId, text, mapping, meta) };
}

export async function loadDealCoverage(supabase: Admin, accountId: string): Promise<DealCoverage> {
  return computeDealCoverage(await loadAllDeals(supabase, accountId));
}
