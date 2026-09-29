"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, LayoutDashboard, MessagesSquare } from "lucide-react";
import { ConnectPurchase } from "@/components/marketing/connect-purchase";
import { trackEvent } from "@/lib/analytics";
import { CONNECT_NAME } from "@/lib/connect";
import { DEMO_URL } from "@/lib/demo";

type Path = "choose" | "dashboard" | "connect";

// The front door of onboarding: dashboard or your own AI assistant. The
// dashboard is sales-assisted only — there is no self-serve path to it
// anymore, so "dashboard" always renders a book-a-demo panel below, never
// OnboardingFlow (its checkout flow, still imported by nothing else, is
// left fully intact in onboarding-flow.tsx: pointing this branch back at
// <OnboardingFlow initiallySignedIn={initiallySignedIn} hasAccount={hasAccount} />
// is the entire revert). This close-off is intentional even for someone
// arriving via ?plan=plus, ?path=dashboard, or already signed in with an
// account — none of those should be able to reach self-serve checkout for
// the dashboard tier (see the matching server-side rejection in
// /api/stripe/checkout/route.ts, which is what actually stops a direct API
// call). The assistant path is a purchase of Ripplewatch Connect (account,
// then Stripe Checkout) and is unaffected.
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
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LayoutDashboard className="size-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">The Ripplewatch dashboard is sales-assisted</h1>
        <p className="text-sm text-muted-foreground">
          Book a demo and we&apos;ll get your workspace set up with you, rather than a self-serve signup.
        </p>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("onboarding_path", { path: "dashboard_demo" })}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Calendar className="size-3.5" />
          Book a demo
        </a>
      </div>
    );
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
          onClick={() => pick("connect")}
          className="relative flex flex-col items-start gap-3 rounded-2xl border border-primary/50 bg-card p-6 text-left shadow-sm shadow-primary/10 transition-colors hover:border-primary"
        >
          <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
            Most flexible
          </span>
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessagesSquare className="size-5" />
          </span>
          <span className="text-base font-semibold">My AI assistant</span>
          <span className="text-sm text-muted-foreground">
            Use Ripplewatch inside Claude or ChatGPT, no dashboard. {CONNECT_NAME} is $29/month plus usage you prepay for.
          </span>
        </button>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("onboarding_path", { path: "dashboard_demo" })}
          className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/50"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutDashboard className="size-5" />
          </span>
          <span className="text-base font-semibold">The Ripplewatch dashboard</span>
          <span className="text-sm text-muted-foreground">
            A shared workspace your whole team logs into. Fixed monthly price, Slack and email delivery. Book a demo to get set up.
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-primary">
            <Calendar className="size-3.5" />
            Book a demo
          </span>
        </a>
      </div>
    </div>
  );
}
