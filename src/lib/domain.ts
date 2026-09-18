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

// Loopback/private/link-local hosts an anonymous visitor could otherwise use
// this app's fetchers to probe. Shared by /api/snapshot (the one place a
// domain comes from an unauthenticated visitor) and by the snapshot's
// link-discovery step, since a link scraped off a stranger's homepage is
// just as attacker-controlled as a domain typed into the form. Not a full
// SSRF defense (that would need resolving DNS and checking the resulting
// IP), but it closes the obvious door for the cost involved.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /\.local$/i,
  /\.internal$/i,
];

export function isBlockedHost(host: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

export function isBlockedUrl(url: string): boolean {
  try {
    return isBlockedHost(new URL(url).hostname);
  } catch {
    return true;
  }
}
