// A competitor "name" that reads like an ad headline or a sentence, not a company ("Get Up To $500 In 5 Minutes Or Less").
// Caught by shape only, so it never guesses about real but unusual names.
export function looksLikeNotACompany(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  return n.split(/\s+/).length >= 5 || n.length > 40 || /[$%!?]/.test(n);
}

export function suspectCompetitorNames(names: string[]): string[] {
  return names.filter(looksLikeNotACompany);
}
