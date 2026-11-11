"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ConnectPurchase } from "@/components/marketing/connect-purchase";
import { UTM_STORAGE_KEY } from "@/components/utm-capture";
import { CONNECT_NAME } from "@/lib/connect";

// The front door of onboarding. Ripplewatch Connect is the only product on
// sale, so every visit goes straight to its purchase flow, whatever query
// string (?path=, ?plan=) an old link carries. The old multi-step dashboard
// checkout is still in onboarding-flow.tsx but nothing points at it, and
// /api/stripe/checkout rejects the dashboard tier server-side.
export function OnboardingEntry({
  initiallySignedIn,
  hasAccount,
  pendingCompanyName,
}: {
  initiallySignedIn: boolean;
  hasAccount: boolean;
  pendingCompanyName: string | null;
}) {
  // ?src=assistant: they came from an AI assistant's Connect button (ChatGPT directory, Claude). They
  // already know what they want, so skip the free read and say what happens next.
  const fromAssistant = useSearchParams().get("src") === "assistant";
  useEffect(() => {
    if (!fromAssistant) return;
    // Last-touch source, same store the ad UTMs use, so Admin shows these signups as assistant connects.
    try {
      localStorage.setItem(
        UTM_STORAGE_KEY,
        JSON.stringify({ utm_source: "assistant", utm_medium: "oauth", utm_campaign: "connect-button" })
      );
    } catch {
      // Storage blocked: the signup just isn't tagged.
    }
  }, [fromAssistant]);

  // Someone who already has an account can't add Connect to it: it's a
  // separate product on its own account.
  if (hasAccount) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">You&apos;re signed in to another account</h1>
        <p className="text-sm text-muted-foreground">
          Ripplewatch is bought with a new account, so sign out and sign up with another email to buy it.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Get {CONNECT_NAME}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fromAssistant
            ? "Create your account and pay, then go back to your assistant and press Connect again. It takes about two minutes."
            : "Use Ripplewatch inside Claude or ChatGPT. A flat monthly platform fee, and usage you prepay for, so you only pay for what you use."}
        </p>
      </div>
      <ConnectPurchase
        initiallySignedIn={initiallySignedIn}
        pendingCompanyName={pendingCompanyName}
        skipRead={fromAssistant}
      />
    </div>
  );
}
