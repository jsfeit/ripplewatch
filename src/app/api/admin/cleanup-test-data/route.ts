import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Bulk-deletes named test users and leads. Admin-only (see middleware.ts's
// blanket /api/admin gating), and deliberately request-driven rather than a
// standing "delete everything matching a pattern" button — each call names
// exactly which emails to remove, so a cleanup always has a reviewable list
// behind it instead of a pattern that could catch something real.
//
// A user's own account (if any) is deleted first (cascades to its
// competitors/signals/profile/etc — see accounts' on-delete-cascade FKs),
// then the auth user itself (cascades any remaining profile row, e.g. a
// user with no account). Leads are matched by exact email.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userEmails: string[] = Array.isArray(body?.userEmails) ? body.userEmails.filter((e: unknown) => typeof e === "string") : [];
  const leadEmails: string[] = Array.isArray(body?.leadEmails) ? body.leadEmails.filter((e: unknown) => typeof e === "string") : [];

  if (userEmails.length === 0 && leadEmails.length === 0) {
    return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });
  }

  const admin = createAdminClient();
  const results: { email: string; kind: "user" | "lead"; status: string }[] = [];

  if (userEmails.length > 0) {
    const { data: userList, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

    for (const email of userEmails) {
      const authUser = userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!authUser) {
        results.push({ email, kind: "user", status: "not found" });
        continue;
      }

      const { data: profile } = await admin.from("profiles").select("account_id").eq("id", authUser.id).maybeSingle();
      if (profile?.account_id) {
        const { error: accountError } = await admin.from("accounts").delete().eq("id", profile.account_id);
        if (accountError) {
          results.push({ email, kind: "user", status: `account delete failed: ${accountError.message}` });
          continue;
        }
      }

      const { error: userError } = await admin.auth.admin.deleteUser(authUser.id);
      results.push({ email, kind: "user", status: userError ? userError.message : "deleted" });
    }
  }

  for (const email of leadEmails) {
    const { error, count } = await admin.from("leads").delete({ count: "exact" }).ilike("email", email);
    results.push({ email, kind: "lead", status: error ? error.message : `${count ?? 0} row(s) deleted` });
  }

  return NextResponse.json({ ok: true, results });
}
