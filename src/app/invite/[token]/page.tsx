import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteAccept } from "./invite-accept";

export const metadata = { title: "Join your team", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: invite } = await admin.from("invites").select("*").eq("token", token).single();
  if (!invite) notFound();

  const { data: account } = await admin.from("accounts").select("name").eq("id", invite.account_id).single();
  if (!account) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <InviteAccept
      token={token}
      inviteEmail={invite.email}
      accountName={account.name}
      alreadyAccepted={Boolean(invite.accepted_at)}
      signedInAs={user?.email ?? null}
    />
  );
}
