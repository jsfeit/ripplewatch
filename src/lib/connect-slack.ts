import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

// The connected Slack workspace's credentials for an account, or null when
// Slack isn't connected. Shared by the Connect crons that decide between Slack
// and email.
export async function loadSlackCredentials(supabase: Admin, accountId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("integrations")
    .select("credentials")
    .eq("account_id", accountId)
    .eq("provider", "slack")
    .eq("connected", true)
    .maybeSingle();
  return (data?.credentials as Record<string, unknown> | null) ?? null;
}
