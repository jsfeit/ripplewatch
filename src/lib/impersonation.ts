import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

export const IMPERSONATION_COOKIE = "rw_impersonation";
const IMPERSONATION_TTL_MS = 60 * 60 * 1000; // 1 hour — re-start from the admin panel if you need longer

export type ImpersonationContext = {
  logId: string;
  adminId: string;
  adminEmail: string;
  accountId: string;
  accountName: string;
  startedAt: string;
};

// Validated against the DB on every call rather than trusted from a signed
// cookie: the cookie only carries an opaque log-row id, so a stale or
// tampered cookie can't grant access to an account on its own — the row
// still has to exist, be unexpired, and belong to the currently
// authenticated admin.
export async function getImpersonationContext(currentUserId: string): Promise<ImpersonationContext | null> {
  const cookieStore = await cookies();
  const logId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!logId) return null;

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("admin_impersonation_log")
    .select("id, admin_id, admin_email, target_account_id, target_account_name, started_at, ended_at")
    .eq("id", logId)
    .maybeSingle();

  if (!row || row.ended_at || row.admin_id !== currentUserId) return null;

  const startedAt = new Date(row.started_at);
  if (Date.now() - startedAt.getTime() > IMPERSONATION_TTL_MS) {
    await supabase.from("admin_impersonation_log").update({ ended_at: new Date().toISOString() }).eq("id", row.id);
    return null;
  }

  return {
    logId: row.id,
    adminId: row.admin_id,
    adminEmail: row.admin_email,
    accountId: row.target_account_id,
    accountName: row.target_account_name ?? "Unnamed account",
    startedAt: row.started_at,
  };
}

export type AccountContext = {
  accountId: string | null;
  // The RLS-scoped client when reading as yourself; the service-role client
  // when viewing as another account, since auth_account_id() only ever
  // resolves to the *caller's* own account, not the impersonated one.
  db: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
  impersonation: ImpersonationContext | null;
};

// Shared by every /app server component and route handler that currently
// does "look up my own profile's account_id" — swaps in the impersonated
// account and an RLS-bypassing client when a view-as session is active,
// otherwise behaves exactly like the original inline lookup.
export async function resolveAccountContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<AccountContext> {
  const impersonation = await getImpersonationContext(userId);
  if (impersonation) {
    return { accountId: impersonation.accountId, db: createAdminClient(), impersonation };
  }
  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", userId).single();
  return { accountId: profile?.account_id ?? null, db: supabase, impersonation: null };
}
