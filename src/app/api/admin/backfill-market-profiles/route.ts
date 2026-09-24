import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMarketProfileForAccount } from "@/lib/market-profile";
import { mapWithConcurrency } from "@/lib/crawl";

export const maxDuration = 300;

// Matches the monthly industry-trends cron's own ACCOUNT_CONCURRENCY —
// same reasoning (a few LLM calls per account, don't run every missing
// account fully sequentially).
const ACCOUNT_CONCURRENCY = 3;

// One-off catch-up for accounts that existed before market_profile shipped
// (see migration 0072): ensureMarketProfile only self-heals on an
// account's NEXT crawl, so any account whose last crawl predates the
// feature is left showing "No market profile yet" until that happens,
// which can be days or weeks away. Runs the same generation the monthly
// cron and first-crawl self-heal use, just for whichever active accounts
// are missing a row right now, instead of waiting.
export async function POST() {
  const admin = createAdminClient();

  const [{ data: accounts }, { data: existingProfiles }] = await Promise.all([
    admin.from("accounts").select("*").eq("status", "active"),
    admin.from("market_profile").select("account_id"),
  ]);

  const hasProfile = new Set((existingProfiles ?? []).map((p) => p.account_id));
  const missing = (accounts ?? []).filter((a) => !hasProfile.has(a.id));

  const { data: allCompetitors } = await admin.from("competitors").select("account_id, name");
  const namesByAccount = new Map<string, string[]>();
  for (const c of allCompetitors ?? []) {
    const list = namesByAccount.get(c.account_id) ?? [];
    list.push(c.name);
    namesByAccount.set(c.account_id, list);
  }

  const results = await mapWithConcurrency(missing, ACCOUNT_CONCURRENCY, async (account) => {
    const result = await runMarketProfileForAccount(admin, account, namesByAccount.get(account.id) ?? []);
    return { accountId: account.id, ...result };
  });

  return NextResponse.json({ ok: true, checked: accounts?.length ?? 0, missing: missing.length, results });
}
