"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import { Button } from "@/components/ui/button";
import "driver.js/dist/driver.css";
import "./product-tour.css";

// Each selector matches whatever's actually on the page for a first-time
// account: competitor-overview.tsx tags its collapsed summary row (always
// rendered, regardless of whether any competitor rows are expanded yet),
// and the relevance badge is tagged on both a real scored AlertCard and
// the zero-signals SampleAlertPreview, so exactly one of the two exists on
// any given account. Steps whose element isn't in the DOM (or isn't
// visible — the Ask bubble is desktop-only) are dropped rather than
// breaking the tour.
const STEPS: DriveStep[] = [
  {
    element: '[data-tour="competitor-card"]',
    popover: {
      title: "Your tracked competitors",
      description:
        "Every competitor you're watching, at a glance. Click one to expand its momentum, latest signal, and price point.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="relevance-badge"]',
    popover: {
      title: "Every signal gets a verdict",
      description:
        "Not just what changed, but whether it matters to you: scored against your own positioning and lost-deal reasons, not a generic severity scale.",
      side: "top",
    },
  },
  {
    element: '[data-tour="ask-bubble"]',
    popover: {
      title: "Ask anything",
      description: "Don't wait for the next update. Ask about a competitor, a trend, or what's changed, right here.",
      side: "left",
    },
  },
];

function isVisible(el: Element): boolean {
  return (el as HTMLElement).offsetParent !== null;
}

function resolveSteps(): DriveStep[] {
  return STEPS.filter((step) => {
    const selector = typeof step.element === "string" ? step.element : null;
    if (!selector) return false;
    const el = document.querySelector(selector);
    return el !== null && isVisible(el);
  });
}

export function runProductTour() {
  const steps = resolveSteps();
  if (steps.length === 0) return;

  driver({
    showProgress: true,
    animate: false,
    overlayOpacity: 0.55,
    steps,
  }).drive();
}

// Mounted once on the dashboard page. Two triggers:
// - First-ever visit (hasSeenTour is false): fires after a beat so it isn't
//   spotlighting content still laying out, and marks itself seen as soon as
//   the tour starts (not on completion), so clicking away mid-tour still
//   counts and it won't re-fire next visit.
// - "Replay tour" from Settings, which can only navigate here (the tour's
//   targets live on the dashboard, not the settings page) and signals it
//   via a ?tour=1 query param; runs regardless of hasSeenTour, then strips
//   the param so a refresh doesn't repeat it.
export function AutoProductTour({ hasSeenTour }: { hasSeenTour: boolean }) {
  useEffect(() => {
    // Reads window.location directly rather than useSearchParams, same
    // reasoning as settings-view.tsx's own ?tab=/?checkout= handling: no
    // Suspense boundary needed for a one-off query-param check.
    const replay = new URLSearchParams(window.location.search).get("tour") === "1";

    if (replay) {
      // history.replaceState, not router.replace: a Next.js navigation
      // mid-tour re-fetches the server component tree and reflows the
      // page under driver.js's positioned popover, corrupting it. This is
      // a pure client-side URL edit with no render side effects.
      window.history.replaceState(null, "", "/app/dashboard");
      const timer = setTimeout(runProductTour, 300);
      return () => clearTimeout(timer);
    }

    if (hasSeenTour) return;
    const timer = setTimeout(() => {
      fetch("/api/profile/tour-seen", { method: "POST" }).catch(() => {});
      runProductTour();
    }, 700);
    return () => clearTimeout(timer);
  }, [hasSeenTour]);

  return null;
}

// Settings > Appearance's "Replay tour" button. The tour's targets only
// exist on the dashboard, so this navigates there with ?tour=1 rather than
// trying to run it in place.
export function ReplayTourButton() {
  const router = useRouter();
  return (
    <Button variant="outline" onClick={() => router.push("/app/dashboard?tour=1")}>
      Replay tour
    </Button>
  );
}
