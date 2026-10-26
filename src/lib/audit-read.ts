import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type AuditRow = Database["public"]["Tables"]["audit_log"]["Row"];

export type AuditLogResult = { state: "no-account" } | { state: "not-owner" } | { state: "ok"; accountName: string; rows: AuditRow[] };

// The log is for the account owner only: the person who created the account and
// pays for it. Teammates, and anyone else, get "not-owner". Read with the
// service role because the table has no policies, so this check is the gate.
export async function loadAuditLog(userId: string, limit: number): Promise<AuditLogResult> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("account_id").eq("id", userId).maybeSingle();
  if (!profile?.account_id) return { state: "no-account" };

  const { data: account } = await admin.from("accounts").select("name, created_by").eq("id", profile.account_id).single();
  if (!account || account.created_by !== userId) return { state: "not-owner" };

  const { data: rows } = await admin
    .from("audit_log")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { state: "ok", accountName: account.name, rows: rows ?? [] };
}
