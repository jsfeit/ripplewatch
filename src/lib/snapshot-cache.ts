import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SnapshotResult } from "@/lib/snapshot";

// A competitor lookup is reused for this long. Pricing pages, job boards and news move over weeks,
// not hours, and the free read says it checked recently rather than live.
export const SNAPSHOT_CACHE_HOURS = 48;

// Both calls treat any failure (table not created yet, network) as "no cache": the lookup just runs.
export async function getCachedSnapshot(domain: string): Promise<{ result: SnapshotResult; fetchedAt: string } | null> {
  try {
    const since = new Date(Date.now() - SNAPSHOT_CACHE_HOURS * 60 * 60 * 1000).toISOString();
    const { data, error } = await createAdminClient()
      .from("snapshot_cache")
      .select("result, fetched_at")
      .eq("domain", domain)
      .gte("fetched_at", since)
      .maybeSingle();
    if (error || !data) return null;
    return { result: data.result as unknown as SnapshotResult, fetchedAt: data.fetched_at };
  } catch {
    return null;
  }
}

export async function cacheSnapshot(domain: string, result: SnapshotResult): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("snapshot_cache")
      .upsert({ domain, result: result as unknown as Record<string, unknown>, fetched_at: new Date().toISOString() });
    if (error) console.error(`snapshot cache write failed for ${domain}:`, error.message);
  } catch (err) {
    console.error(`snapshot cache write failed for ${domain}:`, err instanceof Error ? err.message : err);
  }
}
