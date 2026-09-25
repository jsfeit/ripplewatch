import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { competitorCap, competitorCapLabel } from "@/lib/tier-limits";
import { discoverCompetitorUrls } from "@/lib/scraping";
import { suggestCompetitorCategories } from "@/lib/anthropic";
import { normalizeDomain, DOMAIN_PATTERN, isBlockedHost } from "@/lib/domain";
import { checkDomain } from "@/lib/snapshot";

type Client = SupabaseClient<Database>;

export type NewCompetitor = {
  id: string;
  name: string;
  domain: string | null;
  category: string | null;
  github_repo: string | null;
  created_at: string;
  account_id: string;
};

export type AddCompetitorResult =
  | {
      ok: true;
      competitor: NewCompetitor;
      notice: { reachability: string; alternates: { domain: string; title: string }[] } | null;
    }
  | { ok: false; status: 400 | 403 | 500; error: string }
  | {
      ok: false;
      status: 409;
      error: string;
      needsConfirmation: true;
      reachability: string;
      title: string | null;
      alternates: { domain: string; title: string }[];
    };

// Everything POST /api/competitors did between "caller is authenticated" and
// "row exists", pulled out so the MCP add_competitor tool runs the identical
// checks: plan cap, domain sanity check (a dead domain is bounced back with
// suggestions unless force is set — the arlo.com vs arlo.co problem), URL
// discovery, category suggestion, insert. The caller still schedules the
// off-request-path reviewNewCompetitor step (it needs next/server's after()).
export async function addCompetitor(
  db: Client,
  accountId: string,
  input: { name: string; domain: string; force?: boolean }
): Promise<AddCompetitorResult> {
  const { data: account } = await db.from("accounts").select("tier, demo_mode").eq("id", accountId).single();

  const { count } = await db.from("competitors").select("id", { count: "exact", head: true }).eq("account_id", accountId);

  const tier = account?.tier ?? "starter";
  const limit = competitorCap(tier, account?.demo_mode ?? false);
  if ((count ?? 0) >= limit) {
    return {
      ok: false,
      status: 403,
      error: `Your plan tracks up to ${competitorCapLabel(limit)} competitors. Upgrade to add more.`,
    };
  }

  const name = input.name.trim();
  const domain = input.domain.trim();
  if (!name) return { ok: false, status: 400, error: "Name is required." };

  // Sanity-check the domain before saving, the same way the public snapshot
  // would: a domain that doesn't exist or is just a placeholder is almost
  // always a typo, and a name shared across endings (arlo.com vs arlo.co) is
  // the classic wrong-company mistake. A live one is saved and any look-alike
  // is returned as a non-blocking notice.
  const cleanDomain = domain ? normalizeDomain(domain).toLowerCase() : "";
  let notice: { reachability: string; alternates: { domain: string; title: string }[] } | null = null;
  if (cleanDomain) {
    if (!DOMAIN_PATTERN.test(cleanDomain) || isBlockedHost(cleanDomain)) {
      return { ok: false, status: 400, error: "Enter a real domain, like acme.com." };
    }
    const check = await checkDomain(cleanDomain);
    const dead = check.reachability === "no_such_site" || check.reachability === "placeholder";
    if (dead && input.force !== true) {
      return {
        ok: false,
        status: 409,
        needsConfirmation: true,
        reachability: check.reachability,
        title: check.title,
        alternates: check.alternates,
        error:
          check.reachability === "placeholder"
            ? `${cleanDomain} looks like a placeholder page, not a live site.`
            : `We couldn't find a website at ${cleanDomain}.`,
      };
    }
    if (check.alternates.length > 0) notice = { reachability: check.reachability, alternates: check.alternates };
  }

  const [urls, categories] = await Promise.all([
    domain ? discoverCompetitorUrls(domain) : Promise.resolve({ pricingUrl: null, careersUrl: null }),
    suggestCompetitorCategories([{ name, domain: domain || null }], accountId).catch(() => [""]),
  ]);

  const { data, error } = await db
    .from("competitors")
    .insert({
      account_id: accountId,
      name,
      domain: domain || null,
      category: categories[0] || null,
      pricing_url: urls.pricingUrl,
      careers_url: urls.careersUrl,
    })
    .select("id, name, domain, category, github_repo, created_at, account_id")
    .single();

  if (error) return { ok: false, status: 500, error: error.message };

  return { ok: true, competitor: data, notice };
}
