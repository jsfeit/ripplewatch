import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Which assistants this account has actually connected (claude, chatgpt, cursor, ...), read from the
// connections recorded when each one was approved. Empty when none is recorded yet; callers treat that
// as "can't tell". Never throws: a missing table or a failed read just means "can't tell".
export async function loadConnectedAssistants(accountId: string): Promise<string[]> {
  try {
    const { data } = await createAdminClient().from("mcp_connections").select("assistant").eq("account_id", accountId);
    return [...new Set((data ?? []).map((r) => r.assistant))];
  } catch {
    return [];
  }
}
