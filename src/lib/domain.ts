export const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

// People often paste a full URL ("https://www.acme.com/pricing") into a
// field that just wants the bare domain — strip the protocol and anything
// from the first /, ?, or # so pasted URLs validate instead of bouncing as
// "invalid domain" over a trailing slash or path.
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]
    .trim();
}

// Best-effort default so pricing/jobs monitoring isn't dead on arrival for
// every new competitor — right, not guaranteed. "/pricing" and "/careers"
// are the most common paths, but plenty of sites use something else (a
// Greenhouse/Lever careers board, a regional pricing subdomain, etc.), so
// this is always shown as an editable, correctable value, never silently
// trusted.
export function guessPricingUrl(domain: string): string | null {
  const clean = normalizeDomain(domain);
  return clean ? `https://${clean}/pricing` : null;
}

export function guessCareersUrl(domain: string): string | null {
  const clean = normalizeDomain(domain);
  return clean ? `https://${clean}/careers` : null;
}
