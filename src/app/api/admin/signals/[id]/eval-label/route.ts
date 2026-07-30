import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const label = body?.label;
  if (label !== "correct" && label !== "incorrect") {
    return NextResponse.json({ error: "label must be 'correct' or 'incorrect'." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("signal_eval_labels")
    .upsert(
      { signal_id: id, label, note: body?.note?.trim() || null },
      { onConflict: "signal_id" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ label: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("signal_eval_labels").delete().eq("signal_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
