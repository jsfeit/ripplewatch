import type { DealColumnMapping } from "@/lib/deal-csv";

// A mapping that came from the browser is checked against the file's real columns before it is used.
export function parseMapping(input: unknown, header: string[]): DealColumnMapping | null {
  if (!input || typeof input !== "object") return null;
  const m = input as Record<string, unknown>;
  const col = (v: unknown): string | null => (typeof v === "string" && header.includes(v) ? v : null);

  const outcomeValues: DealColumnMapping["outcomeValues"] = {};
  if (m.outcomeValues && typeof m.outcomeValues === "object") {
    for (const [k, v] of Object.entries(m.outcomeValues as Record<string, unknown>)) {
      if (v === "won" || v === "lost" || v === "churned" || v === "ignore") outcomeValues[k.trim().toLowerCase()] = v;
    }
  }
  const mapping: DealColumnMapping = {
    closeDate: col(m.closeDate),
    amount: col(m.amount),
    outcome: col(m.outcome),
    competitor: col(m.competitor),
    reason: (Array.isArray(m.reason) ? m.reason : []).map(col).filter((c): c is string => Boolean(c)),
    dealName: col(m.dealName),
    dealId: col(m.dealId),
    owner: col(m.owner),
    segment: col(m.segment),
    dateOrder: m.dateOrder === "ymd" || m.dateOrder === "dmy" ? m.dateOrder : "mdy",
    outcomeValues,
  };
  return mapping.outcome ? mapping : null;
}
