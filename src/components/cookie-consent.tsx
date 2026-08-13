"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const STORAGE_KEY = "rw-cookie-consent";

// Gates GA4 behind consent instead of firing it unconditionally — GA sets
// non-essential cookies (_ga, _gid), which need consent under GDPR/ePrivacy.
// Vercel Analytics is unaffected: it's cookieless and stays loaded in layout.tsx.
export function CookieConsent() {
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Syncing one-time from localStorage on mount, not deriving state from
    // props/other state — SSR has no localStorage, so this can't run any
    // earlier than the client-side effect.
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "granted" || stored === "denied") setConsent(stored);
    setHydrated(true);
  }, []);

  function choose(value: "granted" | "denied") {
    localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  }

  return (
    <>
      {consent === "granted" && GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}

      {hydrated && consent === null && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              We use cookies for analytics to understand how people use Ripplewatch. See our{" "}
              <a href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </a>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => choose("denied")}>
                Decline
              </Button>
              <Button size="sm" onClick={() => choose("granted")}>
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
