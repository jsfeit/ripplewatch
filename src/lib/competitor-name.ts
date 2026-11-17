// A competitor's name is the brand, not whatever a model or a page title happened to say. A suggestion once
// came back as "Get Up To $500 In 5 Minutes Or Less" (a marketing headline from dave.com) and was saved
// as the name, so the assistant then talked about a company called that. Pure, so it can run anywhere a
// name is about to be saved.

const HEADLINE_WORDS = /\b(or less|get up to|sign up|sign in|log in|free trial|official site|official website|in \d+ minutes?|apply now|download)\b/i;

function domainLabel(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  const label = host.split(".")[0];
  if (!label || !/^[a-z0-9-]+$/.test(label)) return null;
  return label
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function looksLikeHeadline(name: string): boolean {
  const words = name.split(/\s+/).filter(Boolean);
  return name.length > 40 || words.length > 5 || /[$!?]/.test(name) || HEADLINE_WORDS.test(name);
}

export function cleanCompetitorName(rawName: string, domain?: string | null): string {
  const name = rawName.replace(/\s+/g, " ").trim();
  if (!name) return name;
  if (!looksLikeHeadline(name)) return name;

  // "Brand | tagline" or "tagline - Brand": keep the segment that matches the domain, or a short first one.
  const label = domainLabel(domain)?.toLowerCase().replace(/\s+/g, "") ?? null;
  const segments = name.split(/\s+[|–—-]\s+|:\s+/).map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    const match = label ? segments.find((s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").includes(label) && !looksLikeHeadline(s)) : null;
    if (match) return match;
    const short = segments.find((s) => s.length <= 25 && !looksLikeHeadline(s));
    if (short) return short;
  }

  // Otherwise the brand is what the domain says it is.
  return domainLabel(domain) ?? name;
}
