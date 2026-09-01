import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// No 0/O/1/I ambiguity — same alphabet as admin/promo-codes' randomCode().
const SUFFIX_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)];
  return s;
}

function slugifyCompanyName(name: string): string {
  const alphanumeric = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (alphanumeric || "REF").slice(0, 8);
}

// Generates the account's referral code lazily on first request rather than
// at signup — most accounts will never open Settings > Refer & earn, so
// this avoids minting a code (and reserving a unique slug) for every
// account regardless of whether they ever use it.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).single();
  if (!profile?.account_id) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("referral_code, name")
    .eq("id", profile.account_id)
    .single();
  if (!account) {
    return NextResponse.json({ error: "No account." }, { status: 400 });
  }
  if (account.referral_code) {
    return NextResponse.json({ code: account.referral_code });
  }

  // Uses the admin client only for the write (RLS has no update policy for
  // regular users on accounts.referral_code) — retries on the rare unique
  // collision rather than needing a globally-unique-by-construction scheme.
  const admin = createAdminClient();
  const base = slugifyCompanyName(account.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${base}${randomSuffix(3)}`;
    const { error } = await admin.from("accounts").update({ referral_code: code }).eq("id", profile.account_id);
    if (!error) {
      return NextResponse.json({ code });
    }
    if (error.code !== "23505") {
      return NextResponse.json({ error: "Could not generate a referral code." }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Could not generate a unique referral code. Try again." }, { status: 500 });
}
