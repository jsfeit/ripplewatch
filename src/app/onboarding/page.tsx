import { Suspense } from "react";
import Link from "next/link";
import { Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingEntry } from "./onboarding-entry";

export const metadata = { title: "Set up your workspace", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const supabase = await createClient();
  // Only shapes the form (is there a session, whose company name). Middleware already verified the
  // session with Supabase on this request, and every write is checked again server-side, so this
  // reads it from the cookie instead of paying for a second network round trip.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  // Distinct from `initiallySignedIn`: a user can have a session (e.g. their
  // signUp() succeeded moments ago) without an account yet, if the page
  // reloaded before onboarding completion finished. Those users still need
  // the full flow (account + competitors + plan/checkout), just without the
  // email/password fields — see onboarding-flow.tsx's `hasAccount` handling.
  let hasAccount = false;
  // An account that was created but never paid (they closed the payment window, or came back
  // another day) is not "another account": it resumes at payment under the name they gave.
  let unpaidCompanyName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id, accounts(name, tier, status, subscription_status)")
      .eq("id", user.id)
      .single();
    hasAccount = Boolean(profile?.account_id);
    const account = Array.isArray(profile?.accounts) ? profile.accounts[0] : profile?.accounts;
    if (account && account.tier === "connect" && account.status === "hold" && !account.subscription_status) {
      hasAccount = false;
      unpaidCompanyName = account.name;
    }
  }

  // Set at signUp() time (see connect-purchase.tsx) so the company name
  // survives even when the confirmation link is opened in a different
  // tab/window than the one that filled the form — the common case, and
  // the reason people were landing back on a blank "company name" field
  // after already typing it once.
  const pendingCompanyName = unpaidCompanyName ?? (user?.user_metadata?.company_name as string | undefined) ?? null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Waves className="size-4" />
            </span>
            Ripplewatch
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Suspense>
          <OnboardingEntry
            initiallySignedIn={Boolean(user)}
            hasAccount={hasAccount}
            pendingCompanyName={pendingCompanyName}
          />
        </Suspense>
      </main>
    </div>
  );
}
