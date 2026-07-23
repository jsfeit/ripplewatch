import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_TIERS = ["starter", "plus", "plus_human"];

// Manual override for sales-assisted upgrades (Plus + Human has no
// self-serve checkout — this is the only way that tier ever gets set).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const tier = body?.tier;

  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({ tier })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
