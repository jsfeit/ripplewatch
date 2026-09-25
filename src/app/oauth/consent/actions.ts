"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseMcp } from "@/lib/tier-limits";

const AUTHORIZATION_ID = /^[\w-]{8,200}$/;

// Approve or deny one pending connector authorization. The plan is checked
// again here, not just when the page rendered: the page hides the buttons for
// an account that can't use the connector, but the action is what actually
// hands a client a token.
export async function decideAuthorization(formData: FormData) {
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const decision = formData.get("decision") === "approve" ? "approve" : "deny";
  if (!AUTHORIZATION_ID.test(authorizationId)) redirect("/oauth/consent?error=invalid");

  const consentPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(consentPath)}`);

  if (decision === "approve") {
    const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).maybeSingle();
    const { data: account } = profile?.account_id
      ? await supabase.from("accounts").select("tier, demo_mode").eq("id", profile.account_id).single()
      : { data: null };
    if (!account || !canUseMcp(account.tier, account.demo_mode)) redirect(`${consentPath}&error=plan`);
  }

  const result =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });

  if (result.error || !result.data?.redirect_url) redirect(`${consentPath}&error=failed`);
  redirect(result.data.redirect_url);
}
