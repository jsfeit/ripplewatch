"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutDashboard, MessagesSquare } from "lucide-react";
import { ConnectPurchase } from "@/components/marketing/connect-purchase";
import { trackEvent } from "@/lib/analytics";
import { CONNECT_NAME } from "@/lib/connect";
import { OnboardingFlow } from "./onboarding-flow";

type Path = "choose" | "dashboard" | "connect";

// The front door of onboarding: dashboard or your own AI assistant. The
// dashboard path is the existing flow, unchanged. The assistant path is an
// purchase of Ripplewatch Connect (account, then Stripe Checkout).
//
// The choice is skipped whenever the visitor has already decided or is
// already inside the flow: they arrived from a pricing-page plan button
// (?plan=), they're signed in or resuming after email confirmation, or a link
// explicitly picked a path (?path=dashboard from the Connect confirmation).
export function OnboardingEntry({ initiallySignedIn, hasAccount }: { initiallySignedIn: boolean; hasAccount: boolean }) {
  const searchParams = useSearchParams();
  const requestedPath = searchParams.get("path");
  const alreadyDecided = initiallySignedIn || hasAccount || Boolean(searchParams.get("plan")) || requestedPath === "dashboard";

  const [path, setPath] = useState<Path>(
    requestedPath === "connect" ? "connect" : alreadyDecided ? "dashboard" : "choose"
  );

  function pick(next: Exclude<Path, "choose">) {
    trackEvent("onboarding_path", { path: next });
    setPath(next);
  }

  if (path === "dashboard") {
    return <OnboardingFlow initiallySignedIn={initiallySignedIn} hasAccount={hasAccount} />;
  }

  if (path === "connect") {
    // Someone who already has a dashboard account can't add Connect to it:
    // it's a separate product on its own account.
    if (hasAccount) {
      return (
        <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{CONNECT_NAME} is its own account</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;re signed in to a dashboard account. {CONNECT_NAME} is a separate product, so sign out and sign up
            with another email to buy it.
          </p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg space-y-6">
        {!initiallySignedIn ? (
          <button
            type="button"
            onClick={() => setPath("choose")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Get {CONNECT_NAME}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use Ripplewatch inside Claude or ChatGPT. A flat monthly platform fee, and usage you prepay for, so you
            only pay for what you use.
          </p>
        </div>
        <ConnectPurchase initiallySignedIn={initiallySignedIn} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">How do you want to use Ripplewatch?</h1>
        <p className="mt-2 text-sm text-muted-foreground">Same competitive intelligence either way. Pick where you want it.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => pick("dashboard")}
          className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/50"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutDashboard className="size-5" />
          </span>
          <span className="text-base font-semibold">The Ripplewatch dashboard</span>
          <span className="text-sm text-muted-foreground">
            Set up your workspace in a few minutes and see a live preview. Fixed monthly price, Slack and email delivery.
          </span>
        </button>
        <button
          type="button"
          onClick={() => pick("connect")}
          className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/50"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessagesSquare className="size-5" />
          </span>
          <span className="text-base font-semibold">My AI assistant</span>
          <span className="text-sm text-muted-foreground">
            Use Ripplewatch inside Claude or ChatGPT, no dashboard. {CONNECT_NAME} is $29/month plus usage you prepay for.
          </span>
        </button>
      </div>
    </div>
  );
}
