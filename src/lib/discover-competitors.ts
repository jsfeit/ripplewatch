import "server-only";
import { discoverNewCompetitors } from "@/lib/anthropic";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type AdminSupabase = ReturnType<typeof createAdminClient>;
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export type DiscoverySummary = { account: string; suggested: number; error?: string };

// Shared between the weekly cron (loops every account) and the admin
// single-account trigger — same logic either way, just a different set of
// accounts to run it for.
export async function runDiscoveryForAccount(supabase: AdminSupabase, account: Account): Promise<DiscoverySummary> {
  const [{ data: competitors }, { data: existingSuggestions }] = await Promise.all([
    supabase.from("competitors").select("name").eq("account_id", account.id),
    supabase.from("suggested_competitors").select("name").eq("account_id", account.id),
  ]);

  const knownNames = new Set(
    [...(competitors ?? []).map((c) => c.name), ...(existingSuggestions ?? []).map((s) => s.name)].map((n) =>
      n.toLowerCase()
    )
  );

  try {
    const discovered = await discoverNewCompetitors(
      { companyName: account.name, positioning: account.positioning, icp: account.icp },
      (competitors ?? []).map((c) => c.name),
      account.id
    );

    const fresh = discovered.filter((c) => !knownNames.has(c.name.toLowerCase()));
    if (fresh.length === 0) {
      return { account: account.name, suggested: 0 };
    }

    const { error } = await supabase.from("suggested_competitors").insert(
      fresh.map((c) => ({
        account_id: account.id,
        name: c.name,
        domain: c.domain || null,
        category: c.category || null,
        reasoning: c.reasoning || null,
      }))
    );

    return { account: account.name, suggested: error ? 0 : fresh.length, error: error?.message };
  } catch (err) {
    console.error(`competitor discovery failed for ${account.name}:`, err);
    return { account: account.name, suggested: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
