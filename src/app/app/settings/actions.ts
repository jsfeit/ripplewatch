"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { IntegrationProvider } from "@/lib/supabase/types";

const VALID_PROVIDERS: IntegrationProvider[] = [
  "slack",
  "email",
  "hubspot",
  "salesforce",
  "intercom",
  "gong",
  "zoom",
];

export async function disconnectIntegrationAction(formData: FormData) {
  const raw = formData.get("provider");
  if (typeof raw !== "string" || !VALID_PROVIDERS.includes(raw as IntegrationProvider)) return;
  const provider = raw as IntegrationProvider;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) return;

  // RLS scopes this to the caller's own account — provider is one of a
  // small fixed set, no injection surface.
  await supabase
    .from("integrations")
    .update({ connected: false, credentials: null, connected_at: null })
    .eq("account_id", profile.account_id)
    .eq("provider", provider);

  revalidatePath("/app/settings");
}
