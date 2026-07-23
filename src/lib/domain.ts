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
