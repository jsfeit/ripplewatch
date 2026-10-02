import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverCompetitorUrls } from "@/lib/scraping";
import { suggestCompetitorCategories, researchCompanyContext } from "@/lib/anthropic";
import { enqueueCrawlForAccount } from "@/lib/crawl";

type CompetitorInput = { name: string; domain: string };

// Fills in the context a Connect account skips at checkout (just company
// name + card, to keep signup fast) — positioning, ICP, and competitors.
// Unlike /api/onboarding/complete, the account and profile link already
// exist (created at checkout by /api/connect/account), so this only ever
// updates, never inserts. Same competitor-discovery and first-crawl kickoff
// as the dashboard flow, so a Connect account's first question to its
// assistant has real signals to draw on instead of an empty account.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) return NextResponse.json({ error: "No account yet." }, { status: 400 });
  const accountId = profile.account_id;

  const { data: account } = await supabase.from("accounts").select("id, name, tier").eq("id", accountId).single();
  if (!account || account.tier !== "connect") {
    return NextResponse.json({ error: "This account isn't a Ripplewatch Connect account." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const {
    positioning,
    icp,
    competitors,
    hasSalesCrm,
    hasPlg,
  }: {
    positioning?: string;
    icp?: string;
    competitors: CompetitorInput[];
    hasSalesCrm?: boolean;
    hasPlg?: boolean;
  } = body;

  const namedCompetitors = (competitors ?? []).filter((c) => c.name?.trim());
  if (namedCompetitors.length === 0) {
    return NextResponse.json({ error: "Add at least one competitor." }, { status: 400 });
  }

  const { error: accountError } = await supabase
    .from("accounts")
    .update({
      positioning: positioning?.trim() || null,
      icp: icp?.trim() || null,
      has_sales_crm: Boolean(hasSalesCrm),
      has_plg: Boolean(hasPlg),
      connect_get_started_dismissed_at: new Date().toISOString(),
    })
    .eq("id", accountId);
  if (accountError) {
    console.error("connect onboarding account update failed:", accountError);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }

  // Same discovery/categorization as the dashboard flow — see
  // /api/onboarding/complete for why these run in parallel.
  const [competitorUrls, categories] = await Promise.all([
    Promise.all(
      namedCompetitors.map((c) => {
        const domain = c.domain?.trim() || null;
        return domain ? discoverCompetitorUrls(domain) : Promise.resolve({ pricingUrl: null, careersUrl: null });
      })
    ),
    suggestCompetitorCategories(
      namedCompetitors.map((c) => ({ name: c.name.trim(), domain: c.domain?.trim() || null })),
      accountId
    ).catch(() => namedCompetitors.map(() => "")),
  ]);

  const { error: competitorsError } = await supabase.from("competitors").insert(
    namedCompetitors.map((c, i) => ({
      account_id: accountId,
      name: c.name.trim(),
      domain: c.domain?.trim() || null,
      category: categories[i] || null,
      pricing_url: competitorUrls[i].pricingUrl,
      careers_url: competitorUrls[i].careersUrl,
    }))
  );
  if (competitorsError) {
    console.error("connect onboarding competitors insert failed:", competitorsError);
    return NextResponse.json({ error: "Could not save competitors." }, { status: 500 });
  }

  // Best-effort, fire-and-forget — same pattern as the dashboard flow: a
  // brand-new account with zero signals is the worst possible first
  // impression, so this queues the backfill crawl right away instead of
  // waiting for the next scheduled cron run.
  const researchPromise = researchCompanyContext(account.name, positioning?.trim() || null, accountId)
    .then((summary) =>
      supabase
        .from("accounts")
        .update({ company_research: summary, company_research_updated_at: new Date().toISOString() })
        .eq("id", accountId)
    )
    .catch((err) => console.error("connect onboarding company research failed:", err));

  after(async () => {
    await researchPromise.catch(() => {});
    try {
      const admin = createAdminClient();
      const { data: fullAccount } = await admin.from("accounts").select("*").eq("id", accountId).single();
      if (fullAccount) await enqueueCrawlForAccount(admin, fullAccount);
    } catch (err) {
      console.error("connect onboarding backfill crawl enqueue failed:", err);
    }
  });

  return NextResponse.json({ ok: true });
}
