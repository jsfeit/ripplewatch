import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

// How long a cancelled account's data is kept before it is deleted, and how far
// ahead of that the "your data will be deleted" email goes out. The privacy
// policy, FAQ and security page all say 30 days: change them with this.
export const RETENTION_DAYS = 30;
export const RETENTION_NOTICE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function retentionDeleteDate(canceledAt: string): Date {
  return new Date(new Date(canceledAt).getTime() + RETENTION_DAYS * DAY_MS);
}

// Deletes everything an account holds: uploaded files, then the account row (the
// competitors, signals, deals, wallet and the rest go with it through the
// cascading foreign keys), then the sign-in users who belonged to it. Stripe
// keeps its own payment records, which we don't touch.
export async function deleteAccountData(admin: Admin, accountId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: profiles, error: profileError } = await admin.from("profiles").select("id").eq("account_id", accountId);
  if (profileError) return { ok: false, error: `profiles: ${profileError.message}` };

  const { data: docs } = await admin.from("account_documents").select("storage_path").eq("account_id", accountId);
  const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from("account-documents").remove(paths);
    if (storageError) return { ok: false, error: `storage: ${storageError.message}` };
  }

  const { error: accountError } = await admin.from("accounts").delete().eq("id", accountId);
  if (accountError) return { ok: false, error: `account: ${accountError.message}` };

  for (const profile of profiles ?? []) {
    const { error: userError } = await admin.auth.admin.deleteUser(profile.id);
    if (userError) return { ok: false, error: `user ${profile.id}: ${userError.message}` };
  }
  return { ok: true };
}
