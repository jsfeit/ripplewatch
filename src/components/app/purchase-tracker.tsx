"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

// Fires once on landing back from Stripe's embedded Checkout via
// return_url, wherever that return_url points (Settings for an existing
// user upgrading, the dashboard for a brand-new paid signup — see
// returnPath on EmbeddedCheckoutModal). Reads window.location directly
// (not useSearchParams) so this doesn't need a Suspense boundary. The bare
// ?checkout=success query param used to be trusted on its own — spoofable
// (anyone can type the URL) and re-fires on every refresh of that exact
// URL, which would have fed Google Ads/GA4 phantom, duplicate, zero-value
// conversions. Now verifies the session actually paid server-side, dedupes
// permanently by session_id in localStorage (not sessionStorage — a
// refresh in the same tab shouldn't re-fire it either), and passes the
// real charged amount so the event is usable for value-based ad bidding,
// not just a raw count.
export function PurchaseTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("checkout") !== "success" || !sessionId) return;

    const dedupeKey = `rw-purchase-tracked-${sessionId}`;
    if (localStorage.getItem(dedupeKey)) return;

    fetch(`/api/stripe/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.paid) return;
        localStorage.setItem(dedupeKey, "1");
        trackEvent("purchase", {
          currency: (data.currency ?? "usd").toUpperCase(),
          value: data.amountTotal ?? undefined,
          transaction_id: sessionId,
        });
        // Same guard the Rewardful snippet itself relies on: window.rewardful
        // is only ever defined when cookie consent was granted (see
        // cookie-consent.tsx) — declined/not-yet-decided consent means the
        // script never loaded, so this silently no-ops rather than throwing.
        const rewardful = (window as typeof window & { rewardful?: (...args: unknown[]) => void }).rewardful;
        if (data.customerEmail && typeof rewardful === "function") {
          rewardful("convert", { email: data.customerEmail });
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
