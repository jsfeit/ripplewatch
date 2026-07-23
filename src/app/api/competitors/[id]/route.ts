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
  if (name !== undefined && !name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // RLS scopes this update to the caller's own account_id.
  const { data, error } = await supabase
    .from("competitors")
    .update({ ...(name !== undefined ? { name } : {}), ...(domain !== undefined ? { domain: domain || null } : {}) })
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
