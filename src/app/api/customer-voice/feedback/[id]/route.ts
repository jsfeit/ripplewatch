import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CustomerFeedbackStatus } from "@/lib/supabase/types";

const VALID_STATUSES: CustomerFeedbackStatus[] = ["new", "considering", "planned", "shipped", "declined"];

// Status is the one field a customer-voice entry changes after logging —
// an NPS score is a fact recorded once, but "what did we do about it"
// evolves, the same reasoning win/loss entries never get a PATCH at all
// (nothing about a logged deal changes) while this needs one.
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
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // RLS scopes this update to the caller's own account's entries.
  const { data, error } = await supabase
    .from("account_customer_feedback")
    .update({ status })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
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

  const { error } = await supabase.from("account_customer_feedback").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
