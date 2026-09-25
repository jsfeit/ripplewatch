import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { API_ACCESS_ALLOWED } from "@/lib/tier-limits";
import { decideAuthorization } from "./actions";

export const metadata = { title: "Connect an app", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  invalid: "That authorization request isn't valid. Go back to the app and try connecting again.",
  plan: "Connecting an AI assistant is part of the Plus plan.",
  failed: "Something went wrong approving that. Go back to the app and try connecting again.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-6 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="size-4" />
          </span>
          Ripplewatch
        </Link>
        {children}
      </div>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold">{title}</h1>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
      </Card>
    </Shell>
  );
}

// The page an MCP client (Claude, ChatGPT, ...) sends the user to during the
// connector sign-in. Supabase Auth's OAuth server hands over an
// authorization_id; this shows who is asking and what they'd get, and the
// buttons approve or deny it.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>;
}) {
  const { authorization_id: authorizationId, error } = await searchParams;

  if (!authorizationId) {
    return <Message title="Nothing to approve" body={ERRORS.invalid} />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
  }

  const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailsError || !data) {
    return <Message title="This request has expired" body={ERRORS.invalid} />;
  }
  // Already approved earlier: straight back to the app.
  if ("redirect_url" in data) redirect(data.redirect_url);

  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", user.id).maybeSingle();
  const { data: account } = profile?.account_id
    ? await supabase.from("accounts").select("name, tier").eq("id", profile.account_id).single()
    : { data: null };
  const allowed = Boolean(account && API_ACCESS_ALLOWED[account.tier]);

  // The host the app will send the user back to, shown plainly so a lookalike
  // client name can't hide where the approval actually goes.
  let returnHost = data.redirect_uri;
  try {
    returnHost = new URL(data.redirect_uri).host;
  } catch {
    // leave the raw value
  }

  return (
    <Shell>
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold">
            Connect {data.client.name || "an app"} to Ripplewatch
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {data.user.email}
            {account ? ` · ${account.name}` : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4 text-primary" />
              This app will be able to
            </p>
            <ul className="list-disc space-y-1 pl-9 text-muted-foreground">
              <li>Read your competitors, momentum, signals and trends</li>
              <li>Ask questions answered against your positioning and ICP</li>
              <li>Add competitors, log won and lost deals, and log customer feedback on your behalf</li>
            </ul>
            <p className="pt-1 text-xs text-muted-foreground">
              It can&apos;t change billing or team settings. You can disconnect it any time in Settings → Developer.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            After you approve, you&apos;ll be sent back to <span className="font-medium text-foreground">{returnHost}</span>.
            Only continue if you started this from that app.
          </p>

          {error && ERRORS[error] ? <p className="text-sm text-destructive">{ERRORS[error]}</p> : null}

          {allowed ? (
            <form action={decideAuthorization} className="flex gap-3">
              <input type="hidden" name="authorization_id" value={authorizationId} />
              <Button type="submit" name="decision" value="approve" className="flex-1">
                Approve
              </Button>
              <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
                Deny
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{ERRORS.plan}</p>
              <div className="flex gap-3">
                <Link href="/app/settings" className="flex-1">
                  <Button type="button" className="w-full">
                    See plans
                  </Button>
                </Link>
                <form action={decideAuthorization} className="flex-1">
                  <input type="hidden" name="authorization_id" value={authorizationId} />
                  <Button type="submit" name="decision" value="deny" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
