import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // RLS scopes this update to the caller's own account_id.
  const { data, error } = await supabase
    .from("competitors")
    .update({
      ...(name !== undefined ? { name } : {}),
      ...(domain !== undefined ? { domain: domain || null } : {}),
      ...(category !== undefined ? { category: category || null } : {}),
      ...(pricingUrl !== undefined ? { pricing_url: pricingUrl || null } : {}),
      ...(careersUrl !== undefined ? { careers_url: careersUrl || null } : {}),
      ...(githubRepo !== undefined ? { github_repo: githubRepo || null } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
