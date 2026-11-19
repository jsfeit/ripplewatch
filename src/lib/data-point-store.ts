import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { findWhatMovesTogether, type CorrPoint, type CorrEvent, type Finding } from "@/lib/data-point-correlation";
import { cleanDataPoints, MAX_METRICS_PER_ACCOUNT, MAX_ROWS_PER_CALL, type DataPointInput } from "@/lib/data-points";

type Admin = SupabaseClient<Database>;

// Postgres says 42P01 when a table does not exist. The migration for data points is applied by hand, so until it is,
// every function here reports "not set up" instead of failing the whole tool.
const isMissingTable = (err: { code?: string; message?: string } | null) =>
  Boolean(err && (err.code === "42P01" || /account_data_points/.test(err.message ?? "") && /does not exist|schema cache/i.test(err.message ?? "")));

export type MetricSummary = { metric: string; label: string; unit: string | null; segments: string[]; points: number; latest: string; higher_is: string };

export async function loadMetricSummaries(supabase: Admin, accountId: string): Promise<{ ready: boolean; metrics: MetricSummary[] }> {
  const { data, error } = await supabase
    .from("account_data_points")
    .select("metric, label, unit, segment, period_start, higher_is")
    .eq("account_id", accountId)
    .order("period_start", { ascending: false })
    .limit(5000);
  if (error) return { ready: !isMissingTable(error), metrics: [] };
  const by = new Map<string, MetricSummary>();
  for (const r of data ?? []) {
    const m = by.get(r.metric) ?? { metric: r.metric, label: r.label ?? r.metric.replace(/_/g, " "), unit: r.unit, segments: [], points: 0, latest: r.period_start, higher_is: r.higher_is };
    m.points++;
    if (r.segment && !m.segments.includes(r.segment)) m.segments.push(r.segment);
    if (r.period_start > m.latest) m.latest = r.period_start;
    by.set(r.metric, m);
  }
  return { ready: true, metrics: [...by.values()] };
}

export type SaveResult =
  | { ok: true; saved: number; rejected: { index: number; reason: string }[]; metrics: number }
  | { ok: false; reason: "not_set_up" | "too_many_metrics" | "none_usable" | "error"; detail?: string; rejected?: { index: number; reason: string }[] };

export async function saveDataPoints(supabase: Admin, accountId: string, rows: DataPointInput[]): Promise<SaveResult> {
  if (rows.length > MAX_ROWS_PER_CALL) return { ok: false, reason: "error", detail: `Send at most ${MAX_ROWS_PER_CALL} rows at a time.` };
  const { clean, rejected } = cleanDataPoints(rows);
  if (clean.length === 0) return { ok: false, reason: "none_usable", rejected };

  const existing = await loadMetricSummaries(supabase, accountId);
  if (!existing.ready) return { ok: false, reason: "not_set_up" };
  const known = new Set(existing.metrics.map((m) => m.metric));
  const incoming = new Set(clean.map((c) => c.metric));
  const added = [...incoming].filter((m) => !known.has(m));
  if (known.size + added.length > MAX_METRICS_PER_ACCOUNT) {
    return { ok: false, reason: "too_many_metrics", detail: `An account can track up to ${MAX_METRICS_PER_ACCOUNT} different metrics; it has ${known.size}. Reuse existing metric names where you can.` };
  }

  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);
  const idByName = new Map((competitors ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  const { error } = await supabase.from("account_data_points").upsert(
    clean.map((c) => ({
      account_id: accountId,
      metric: c.metric,
      label: c.label,
      unit: c.unit,
      value: c.value,
      period_start: c.period_start,
      period_days: c.period_days,
      segment: c.segment,
      competitor_id: c.competitorName ? idByName.get(c.competitorName.toLowerCase()) ?? null : null,
      higher_is: c.higher_is,
      source: "assistant",
      note: c.note,
    })),
    { onConflict: "account_id,metric,segment,period_start" }
  );
  if (error) return isMissingTable(error) ? { ok: false, reason: "not_set_up" } : { ok: false, reason: "error", detail: "Could not save those numbers. Try again in a moment." };
  return { ok: true, saved: clean.length, rejected, metrics: known.size + added.length };
}

// Competitor events a customer metric can be lined up against: pricing changes, product changes, funding. Only ones the
// scoring step did not judge irrelevant, so noise does not create coincidences.
export async function loadCompetitorEvents(supabase: Admin, accountId: string): Promise<CorrEvent[]> {
  const { data: competitors } = await supabase.from("competitors").select("id, name").eq("account_id", accountId);
  const names = new Map((competitors ?? []).map((c) => [c.id, c.name]));
  if (names.size === 0) return [];
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("signals")
    .select("competitor_id, type, occurred_on, relevance_score")
    .in("competitor_id", [...names.keys()])
    .in("type", ["pricing", "product_change", "funding"])
    .gte("occurred_on", since);
  return (data ?? [])
    .filter((s) => s.relevance_score === null || s.relevance_score >= 30)
    .map((s) => ({ competitor: names.get(s.competitor_id) ?? "A competitor", type: s.type, date: s.occurred_on }));
}

export async function loadWhatMovesTogether(supabase: Admin, accountId: string): Promise<{ ready: boolean; findings: Finding[]; metrics: number }> {
  const { data, error } = await supabase
    .from("account_data_points")
    .select("metric, label, unit, segment, value, period_start, higher_is")
    .eq("account_id", accountId)
    .order("period_start", { ascending: true })
    .limit(20000);
  if (error) return { ready: !isMissingTable(error), findings: [], metrics: 0 };
  const points: CorrPoint[] = (data ?? []).map((r) => ({ metric: r.metric, label: r.label, unit: r.unit, segment: r.segment, value: Number(r.value), period_start: r.period_start, higher_is: r.higher_is }));
  const events = await loadCompetitorEvents(supabase, accountId);
  return { ready: true, findings: findWhatMovesTogether(points, events), metrics: new Set(points.map((p) => p.metric)).size };
}
