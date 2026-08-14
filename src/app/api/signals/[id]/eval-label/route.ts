import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Customer-facing thumbs up/down on a signal — reuses the same
// signal_eval_labels table the admin accuracy view reads from (see
// /admin/signals), so real customer judgment feeds directly into the same
// scoring-accuracy measure instead of a separate, disconnected metric.
// RLS (migration 0025) scopes this to signals belonging to the caller's own
// account; no explicit ownership check needed here beyond being signed in.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const label = body?.label;
  if (label !== "correct" && label !== "incorrect") {
    return NextResponse.json({ error: "label must be 'correct' or 'incorrect'." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("signal_eval_labels")
    .upsert({ signal_id: id, label, labeled_by: user.id }, { onConflict: "signal_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ label: data });
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

  // RLS scopes this delete to the caller's own account's signals.
  const { error } = await supabase.from("signal_eval_labels").delete().eq("signal_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
