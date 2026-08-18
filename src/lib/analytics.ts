// Thin wrapper around gtag for conversion events (sign_up, begin_checkout,
// purchase, generate_lead) — separate from the basic pageview tracking
// that's already wired up in cookie-consent.tsx. Safe to call unconditionally:
// no-ops if GA hasn't loaded, whether because consent hasn't been granted yet
// or NEXT_PUBLIC_GA_MEASUREMENT_ID isn't set (e.g. in dev/staging).
//
// Also mirrors the same four events to LinkedIn's Insight Tag (window.lintrk)
// so LinkedIn Ads sees the identical conversion set GA does, one call site
// instead of duplicating a second trackEvent-alike at every call site. Each
// event name maps to a LinkedIn "conversion_id" minted in Campaign Manager
// (Analyze -> Conversion Tracking); events without a mapped env var just
// skip the LinkedIn half and still fire to GA.
type GtagEventParams = Record<string, string | number | boolean | undefined>;

const LINKEDIN_CONVERSION_IDS: Record<string, string | undefined> = {
  generate_lead: process.env.NEXT_PUBLIC_LINKEDIN_CONVERSION_LEAD,
  sign_up: process.env.NEXT_PUBLIC_LINKEDIN_CONVERSION_SIGNUP,
  begin_checkout: process.env.NEXT_PUBLIC_LINKEDIN_CONVERSION_CHECKOUT,
  purchase: process.env.NEXT_PUBLIC_LINKEDIN_CONVERSION_PURCHASE,
};

export function trackEvent(name: string, params?: GtagEventParams): void {
  if (typeof window === "undefined") return;

  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", name, params);

  const conversionId = LINKEDIN_CONVERSION_IDS[name];
  const lintrk = (window as typeof window & { lintrk?: (...args: unknown[]) => void }).lintrk;
  if (conversionId && typeof lintrk === "function") {
    lintrk("track", { conversion_id: Number(conversionId) });
  }
}
