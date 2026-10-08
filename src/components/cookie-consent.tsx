"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const LINKEDIN_PARTNER_ID = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
const REWARDFUL_API_KEY = process.env.NEXT_PUBLIC_REWARDFUL_API_KEY;
const APOLLO_TRACKER_ID = process.env.NEXT_PUBLIC_APOLLO_TRACKER_ID;
const STORAGE_KEY = "rw-cookie-consent";
// Apollo's visitor tracker is for the public marketing site only. The signed-in
// app, admin, and auth pages are never worth identifying visitors on.
const NO_APOLLO_PATHS = /^\/(app|admin|login|signup|onboarding|invite|oauth)(\/|$)/;

// Gates GA4, the LinkedIn Insight Tag, Rewardful, and Apollo's visitor tracker behind consent instead
// of firing them unconditionally — all three set non-essential ad/analytics/
// affiliate-attribution cookies (GA's _ga/_gid, LinkedIn's bcookie/
// UserMatchHistory, Rewardful's referral-attribution cookie), which need
// consent under GDPR/ePrivacy. Vercel Analytics is unaffected: it's
// cookieless and stays loaded in layout.tsx.
export function CookieConsent() {
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

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

      {consent === "granted" && LINKEDIN_PARTNER_ID && (
        <>
          <Script id="linkedin-insight-init" strategy="afterInteractive">
            {`_linkedin_partner_id = "${LINKEDIN_PARTNER_ID}";
              window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
              window._linkedin_data_partner_ids.push(_linkedin_partner_id);
              (function(l) {
                if (!l) {
                  window.lintrk = function (a, b) { window.lintrk.q.push([a, b]) };
                  window.lintrk.q = [];
                }
                var s = document.getElementsByTagName("script")[0];
                var b = document.createElement("script");
                b.type = "text/javascript"; b.async = true;
                b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
                s.parentNode.insertBefore(b, s);
              })(window.lintrk);`}
          </Script>
          <noscript>
            <img
              height={1}
              width={1}
              style={{ display: "none" }}
              alt=""
              src={`https://px.ads.linkedin.com/collect/?pid=${LINKEDIN_PARTNER_ID}&fmt=gif`}
            />
          </noscript>
        </>
      )}

      {consent === "granted" && REWARDFUL_API_KEY && (
        <>
          <Script id="rewardful-queue" strategy="afterInteractive">
            {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
          </Script>
          <Script async src="https://r.wdfl.co/rw.js" data-rewardful={REWARDFUL_API_KEY} strategy="afterInteractive" />
        </>
      )}

      {consent === "granted" && APOLLO_TRACKER_ID && !NO_APOLLO_PATHS.test(pathname) && (
        // Apollo's own loader, with the tracker id from the environment. Identifies the
        // visiting company on the marketing pages; contact-level tracking is off in Apollo.
        <Script id="apollo-tracker" strategy="afterInteractive">
          {`function initApollo(){var n=Math.random().toString(36).substring(7),o=document.createElement("script");o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,o.async=!0,o.defer=!0,o.onload=function(){window.trackingFunctions.onLoad({appId:"${APOLLO_TRACKER_ID}"})},document.head.appendChild(o)}initApollo();`}
        </Script>
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
