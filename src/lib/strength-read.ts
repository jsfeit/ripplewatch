// Strength read: the direction behind Momentum's volume, in plain words.
//
// Momentum counts how much a competitor is doing. Analysts read what the activity means: raising prices and hiring
// salespeople is strength, discounting and hiring support staff is often trouble. This turns data we already collect
// into those reads, each labeled strength, weakness or neutral, with the numbers that back it. It claims nothing the
// data does not show, skips any read without enough evidence, and is pure so every sentence is testable.
//
// Hiring mix is judged against the other competitors tracked when there are enough of them, because "30% sales" means
// little alone and a lot next to peers at 15%. It reads the current mix of open roles, not a trend.
export type StrengthDirection = "strength" | "weakness" | "neutral";
export type StrengthItem = { topic: "hiring" | "pricing" | "reviews" | "buzz"; direction: StrengthDirection; text: string };
export type StrengthRead = { items: StrengthItem[]; headline: string | null };

export type StrengthInput = {
  hiring: Record<string, number> | null;
  peerHiring: Record<string, number>[];
  priceReadings: { value: number; recorded_at: string }[];
  ratingReadings: { value: number; recorded_at: string }[];
  buzzSummary: string | null;
};

const MIN_ROLES = 8;
const MIN_PEERS = 2;
const GROUPS = {
  sales: /sales|account exec|business dev|revenue|gtm|go-to-market|solutions|partner/i,
  support: /customer (success|support|experience)|support|success|care|onboarding/i,
  engineering: /engineer|product|design|data|developer|infrastructure|security|research/i,
} as const;

function shares(breakdown: Record<string, number>): { total: number; sales: number; support: number; engineering: number } {
  const out = { total: 0, sales: 0, support: 0, engineering: 0 };
  for (const [name, count] of Object.entries(breakdown)) {
    if (!(count > 0)) continue;
    out.total += count;
    // First match wins so a "Customer Success Engineer" counts once, as support.
    if (GROUPS.support.test(name)) out.support += count;
    else if (GROUPS.sales.test(name)) out.sales += count;
    else if (GROUPS.engineering.test(name)) out.engineering += count;
  }
  return out;
}

const pct = (n: number, total: number) => Math.round((n / total) * 100);

function hiringRead(hiring: Record<string, number> | null, peers: Record<string, number>[]): StrengthItem | null {
  if (!hiring) return null;
  const mine = shares(hiring);
  if (mine.total < MIN_ROLES) return null;
  const mySales = pct(mine.sales, mine.total);
  const mySupport = pct(mine.support, mine.total);

  const peerShares = peers.map(shares).filter((p) => p.total >= MIN_ROLES);
  const hasPeers = peerShares.length >= MIN_PEERS;
  const avg = (pick: (p: ReturnType<typeof shares>) => number) => Math.round(peerShares.reduce((a, p) => a + pct(pick(p), p.total), 0) / peerShares.length);

  if (hasPeers) {
    const peerSales = avg((p) => p.sales);
    const peerSupport = avg((p) => p.support);
    if (mySupport >= 20 && mySupport >= peerSupport + 10) {
      return { topic: "hiring", direction: "weakness", text: `Hiring leans toward customer success and support (${mySupport}% of open roles vs ${peerSupport}% among your other competitors), which can point to a retention problem.` };
    }
    if (mySales >= 25 && mySales >= peerSales + 10) {
      return { topic: "hiring", direction: "strength", text: `Hiring leans into sales (${mySales}% of open roles vs ${peerSales}% among your other competitors), which usually means they are pushing to grow.` };
    }
    return null;
  }
  // No peers to compare with: only the clear-cut cases, worded as a tilt, not a verdict.
  if (mySales >= 40) return { topic: "hiring", direction: "strength", text: `${mySales}% of their open roles are in sales, a push to grow.` };
  if (mySupport >= 25) return { topic: "hiring", direction: "weakness", text: `${mySupport}% of their open roles are in customer success or support, which can point to a retention problem.` };
  return null;
}

function trend(readings: { value: number; recorded_at: string }[]): { first: number; last: number } | null {
  const sorted = [...readings].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  if (sorted.length < 2) return null;
  const spanDays = (new Date(sorted[sorted.length - 1].recorded_at).getTime() - new Date(sorted[0].recorded_at).getTime()) / 86_400_000;
  if (spanDays < 14) return null; // two readings a day apart say nothing about direction
  return { first: sorted[0].value, last: sorted[sorted.length - 1].value };
}

function pricingRead(readings: StrengthInput["priceReadings"]): StrengthItem | null {
  const t = trend(readings);
  if (!t || t.first <= 0) return null;
  const change = (t.last - t.first) / t.first;
  if (change >= 0.08) return { topic: "pricing", direction: "strength", text: `Their entry price rose ${Math.round(change * 100)}% (from $${t.first} to $${t.last}). Raising prices is usually a sign of pricing power.` };
  if (change <= -0.08) return { topic: "pricing", direction: "weakness", text: `Their entry price fell ${Math.round(-change * 100)}% (from $${t.first} to $${t.last}). Cutting prices often means they are fighting for volume.` };
  return null;
}

function reviewsRead(readings: StrengthInput["ratingReadings"]): StrengthItem | null {
  const t = trend(readings);
  if (!t) return null;
  const change = t.last - t.first;
  if (change <= -0.2) return { topic: "reviews", direction: "weakness", text: `Their review rating slipped from ${t.first.toFixed(1)} to ${t.last.toFixed(1)}.` };
  if (change >= 0.2) return { topic: "reviews", direction: "strength", text: `Their review rating rose from ${t.first.toFixed(1)} to ${t.last.toFixed(1)}.` };
  return null;
}

export function computeStrengthRead(input: StrengthInput): StrengthRead {
  const items = [hiringRead(input.hiring, input.peerHiring), pricingRead(input.priceReadings), reviewsRead(input.ratingReadings)].filter(
    (i): i is StrengthItem => i !== null
  );
  const summary = input.buzzSummary?.trim();
  if (summary) items.push({ topic: "buzz", direction: "neutral", text: `What people are saying: ${summary}` });

  const strengths = items.filter((i) => i.direction === "strength").length;
  const weaknesses = items.filter((i) => i.direction === "weakness").length;
  let headline: string | null = null;
  if (strengths > 0 && weaknesses === 0) headline = `Reads as pushing to grow (${strengths} sign${strengths === 1 ? "" : "s"} of strength).`;
  else if (weaknesses > 0 && strengths === 0) headline = `Reads as under pressure (${weaknesses} sign${weaknesses === 1 ? "" : "s"} of weakness).`;
  else if (strengths > 0 && weaknesses > 0) headline = `Mixed: ${strengths} sign${strengths === 1 ? "" : "s"} of strength and ${weaknesses} of weakness.`;
  return { items, headline };
}
