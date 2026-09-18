import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountContext } from "@/lib/impersonation";
import { competitorCap, competitorCapLabel } from "@/lib/tier-limits";
import { discoverCompetitorUrls } from "@/lib/scraping";
import { suggestCompetitorCategories } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDomain, DOMAIN_PATTERN, isBlockedHost } from "@/lib/domain";
import { checkDomain } from "@/lib/snapshot";
import { reviewNewCompetitor } from "@/lib/competitor-intake";

// The domain check (a couple of fetches plus look-alike suggestions) and the
// background review that follows both run inside this function's lifetime.
export const maxDuration = 120;

// Scoped to the caller's own account via RLS, except during an admin "View
// as" session (resolveAccountContext swaps in the impersonated account and
// an RLS-bypassing client) — unlike /api/admin/competitors, this never
// touches an account the caller doesn't own or isn't impersonating even if
// account_id were spoofed.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { accountId, db } = await resolveAccountContext(supabase, user.id);
  if (!accountId) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });
  }

  const { data: account } = await db
    .from("accounts")
    .select("tier, demo_mode")
    .eq("id", accountId)
    .single();

  const { count } = await db
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);

  const tier = account?.tier ?? "starter";
  const limit = competitorCap(tier, account?.demo_mode ?? false);
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Your plan tracks up to ${competitorCapLabel(limit)} competitors. Upgrade to add more.` },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const domain = typeof body?.domain === "string" ? body.domain.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // Sanity-check the domain before saving, the same way the public snapshot
  // would: a domain that doesn't exist or is just a placeholder is almost
  // always a typo, and a name shared across endings (arlo.com vs arlo.co) is
  // the classic wrong-company mistake. A dead domain is bounced back with
  // suggestions unless the customer confirms; a live one is saved and any
  // look-alike is returned as a non-blocking notice.
  const cleanDomain = domain ? normalizeDomain(domain).toLowerCase() : "";
  let notice: { reachability: string; alternates: { domain: string; title: string }[] } | null = null;
  if (cleanDomain) {
    if (!DOMAIN_PATTERN.test(cleanDomain) || isBlockedHost(cleanDomain)) {
      return NextResponse.json({ error: "Enter a real domain, like acme.com." }, { status: 400 });
    }
    const check = await checkDomain(cleanDomain);
    const dead = check.reachability === "no_such_site" || check.reachability === "placeholder";
    if (dead && body?.force !== true) {
      return NextResponse.json(
        {
          needsConfirmation: true,
          reachability: check.reachability,
          title: check.title,
          alternates: check.alternates,
          error:
            check.reachability === "placeholder"
              ? `${cleanDomain} looks like a placeholder page, not a live site.`
              : `We couldn't find a website at ${cleanDomain}.`,
        },
        { status: 409 }
      );
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
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Off the request path: try to read the competitor the way the snapshot
  // does, and queue a manual follow-up (plus an alert) if we can't.
  after(() =>
    reviewNewCompetitor(createAdminClient(), data, process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin)
  );

  return NextResponse.json({ competitor: data, notice });
}
