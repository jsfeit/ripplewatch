import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverCompetitorUrls } from "@/lib/scraping";
import { reviewNewCompetitor } from "@/lib/competitor-intake";

export const maxDuration = 120;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const domain = typeof body?.domain === "string" ? body.domain.trim() : undefined;
  const category = typeof body?.category === "string" ? body.category.trim() : undefined;
  const pricingUrl = typeof body?.pricing_url === "string" ? body.pricing_url.trim() : undefined;
  const careersUrl = typeof body?.careers_url === "string" ? body.careers_url.trim() : undefined;
  const githubRepoRaw = typeof body?.github_repo === "string" ? body.github_repo.trim() : undefined;
  if (name !== undefined && !name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // Accepts either the bare "owner/repo" shape or a full github.com URL
  // pasted in (the more natural thing to copy from a browser address bar) —
  // normalized to the bare shape before storage, since that's what
  // fetchGithubCommitVelocity expects.
  let githubRepo = githubRepoRaw;
  if (githubRepoRaw) {
    const urlMatch = githubRepoRaw.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+\/[\w.-]+)/i);
    githubRepo = (urlMatch ? urlMatch[1] : githubRepoRaw).replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
    if (!/^[\w.-]+\/[\w.-]+$/.test(githubRepo)) {
      return NextResponse.json({ error: "GitHub repo should look like owner/repo." }, { status: 400 });
    }
  }

  // Changing the domain used to leave the old pricing/careers URLs pointing at
  // the previous site, so the competitor would keep being "checked" against
  // the wrong company. Re-discover them when the domain actually changes,
  // unless the caller set URLs explicitly, and reset the failure counters
  // that belonged to the old URLs.
  let rediscovered: { pricing_url: string | null; careers_url: string | null } | null = null;
  let domainChanged = false;
  if (domain !== undefined) {
    const { data: current } = await supabase.from("competitors").select("domain").eq("id", id).maybeSingle();
    domainChanged = (current?.domain ?? "") !== domain;
    if (domainChanged && domain) {
      const urls = await discoverCompetitorUrls(domain);
      rediscovered = { pricing_url: urls.pricingUrl, careers_url: urls.careersUrl };
    }
  }

  // RLS scopes this update to the caller's own account_id.
  const { data, error } = await supabase
    .from("competitors")
    .update({
      ...(domainChanged && rediscovered
        ? {
            ...(pricingUrl === undefined ? { pricing_url: rediscovered.pricing_url } : {}),
            ...(careersUrl === undefined ? { careers_url: rediscovered.careers_url } : {}),
            pricing_fetch_failures: 0,
            careers_fetch_failures: 0,
          }
        : {}),
      ...(name !== undefined ? { name } : {}),
      ...(domain !== undefined ? { domain: domain || null } : {}),
      ...(category !== undefined ? { category: category || null } : {}),
      ...(pricingUrl !== undefined ? { pricing_url: pricingUrl || null } : {}),
      ...(careersUrl !== undefined ? { careers_url: careersUrl || null } : {}),
      ...(githubRepo !== undefined ? { github_repo: githubRepo || null } : {}),
    })
    .eq("id", id)
    .select("id, name, domain, category, github_repo, created_at, account_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (domainChanged && data.domain) {
    after(() =>
      reviewNewCompetitor(createAdminClient(), data, process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin)
    );
  }

  return NextResponse.json({ competitor: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // RLS scopes this delete to the caller's own account_id — no explicit
  // ownership check needed beyond being signed in.
  const { error } = await supabase.from("competitors").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
