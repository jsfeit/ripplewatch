import { Suspense } from "react";
import Link from "next/link";
import { Waves } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata = { title: "Set up your workspace", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Distinct from `initiallySignedIn`: a user can have a session (e.g. their
  // signUp() succeeded moments ago) without an account yet, if the page
  // reloaded before onboarding completion finished. Those users still need
  // the full flow (account + competitors + plan/checkout), just without the
  // email/password fields — see onboarding-flow.tsx's `hasAccount` handling.
  let hasAccount = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .single();
    hasAccount = Boolean(profile?.account_id);
  }

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
          <OnboardingFlow initiallySignedIn={Boolean(user)} hasAccount={hasAccount} />
        </Suspense>
      </main>
    </div>
  );
}
