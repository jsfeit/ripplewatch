import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Removes a teammate from the account (unlinks their profile — doesn't
// delete their auth user, they just lose access and would need a fresh
// invite to rejoin). RLS on profiles has no delete/update-by-others policy,
// so this goes through the admin client after confirming the caller shares
// the same account.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });
  }

  if (id === user.id) {
    return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("account_id").eq("id", id).single();
  if (!target || target.account_id !== profile.account_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await admin.from("profiles").update({ account_id: null }).eq("id", id);

  return NextResponse.json({ ok: true });
}
