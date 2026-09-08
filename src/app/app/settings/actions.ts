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

export async function updateSlackDigestScheduleAction(input: {
  timezone: string;
  day: number;
  hour: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(input.day) || input.day < 0 || input.day > 6) {
    return { ok: false, error: "Invalid day" };
  }
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    return { ok: false, error: "Invalid hour" };
  }
  // Confirms input.timezone is a real IANA zone name (Intl throws on a
  // bogus one) rather than trusting client input directly — this value
  // ends up in Intl.DateTimeFormat calls server-side on every cron tick,
  // so a garbage string here would silently break that account's send
  // forever instead of failing loudly now.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
  } catch {
    return { ok: false, error: "Unrecognized timezone" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) return { ok: false, error: "No account" };

  await supabase
    .from("accounts")
    .update({ timezone: input.timezone, slack_digest_day: input.day, slack_digest_hour: input.hour })
    .eq("id", profile.account_id);

  revalidatePath("/app/settings");
  return { ok: true };
}
