"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutDashboard, MessagesSquare } from "lucide-react";
import { ConnectInterestForm } from "@/components/marketing/connect-interest-form";
import { trackEvent } from "@/lib/analytics";
import { CONNECT_NAME } from "@/lib/connect";
import { OnboardingFlow } from "./onboarding-flow";

type Path = "choose" | "dashboard" | "connect";

// The front door of onboarding: dashboard or your own AI assistant. The
// dashboard path is the existing flow, unchanged. The assistant path is an
// early-access request, because Connect isn't purchasable yet; the one way to
// use the connector today is Plus, which the confirmation offers.
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
    alreadyDecided ? "dashboard" : requestedPath === "connect" ? "connect" : "choose"
  );

  function pick(next: Exclude<Path, "choose">) {
    trackEvent("onboarding_path", { path: next });
    setPath(next);
  }

  if (path === "dashboard") {
    return <OnboardingFlow initiallySignedIn={initiallySignedIn} hasAccount={hasAccount} />;
  }

  if (path === "connect") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <button
          type="button"
          onClick={() => setPath("choose")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{CONNECT_NAME} is in early access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us where to reach you and which assistant you use. We&apos;ll email when it opens, with pricing before
            you decide anything.
          </p>
        </div>
        <ConnectInterestForm source="onboarding" />
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
            Use Ripplewatch inside Claude or ChatGPT, no dashboard. {CONNECT_NAME} is in early access, and the connector is
            included in Plus today.
          </span>
        </button>
      </div>
    </div>
  );
}
