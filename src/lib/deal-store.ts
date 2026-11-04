import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type DealRow = Database["public"]["Tables"]["competitor_win_loss"]["Row"];

// Every deal for an account. A plain select stops at 1,000 rows, so this pages.
export async function loadAllDeals(supabase: SupabaseClient<Database>, accountId: string): Promise<DealRow[]> {
  const out: DealRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("competitor_win_loss")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Momentum and the like measure WHEN things happened, so they read the deal's own close date. Rows
// without one (older manual entries) keep the day they were logged.
export function withDealDate<T extends { closed_on: string | null; created_at: string }>(rows: T[]): T[] {
  return rows.map((r) => (r.closed_on ? { ...r, created_at: `${r.closed_on}T12:00:00.000Z` } : r));
}
