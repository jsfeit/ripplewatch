// Thin wrapper around gtag for conversion events (sign_up, begin_checkout,
// purchase, generate_lead) — separate from the basic pageview tracking
// that's already wired up in cookie-consent.tsx. Safe to call unconditionally:
// no-ops if GA hasn't loaded, whether because consent hasn't been granted yet
// or NEXT_PUBLIC_GA_MEASUREMENT_ID isn't set (e.g. in dev/staging).
type GtagEventParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(name: string, params?: GtagEventParams): void {
  if (typeof window === "undefined") return;
  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, params);
}
