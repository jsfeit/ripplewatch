import type { SnapshotLookup } from "@/lib/snapshot";

// Follow-up series for people who only tried the free competitor snapshot
// (not true leads yet: no account, no payment, maybe just curious). Six
// emails over ~6 weeks, then it stops. The wording is written to be honest
// about that: a person who gave an email to use a free tool and gets a
// polite, useful, finite series is a fine outcome; an endless one isn't.
export const SNAPSHOT_DRIP_STEPS = [1, 2, 3, 4, 5, 6] as const;
export type SnapshotDripStep = (typeof SNAPSHOT_DRIP_STEPS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
// Days after the lead was first captured. Compared against age, and the cron
// runs daily and sends at most one step per lead per run, so steps can't
// bunch up even for a backlog.
export const SNAPSHOT_DRIP_AFTER_MS: Record<SnapshotDripStep, number> = {
  1: 1 * DAY_MS,
  2: 3 * DAY_MS,
  3: 7 * DAY_MS,
  4: 14 * DAY_MS,
  5: 30 * DAY_MS,
  6: 45 * DAY_MS,
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// "arlo.co and getadministrate.com", the two most recent distinct domains
// they looked up, so the emails read as a follow-up to what they actually
// did rather than a form letter. Falls back to generic wording for old
// leads with no recorded lookup.
export function lookedUpPhrase(lookups: SnapshotLookup[]): string {
  const recent: string[] = [];
  for (const l of [...lookups].reverse()) {
    if (!recent.includes(l.domain)) recent.push(l.domain);
    if (recent.length === 2) break;
  }
  recent.reverse();
  if (recent.length === 0) return "a competitor";
  return recent.map(escapeHtml).join(" and ");
}

function findingLine(l: SnapshotLookup): string | null {
  const domain = escapeHtml(l.domain);
  const parts: string[] = [];
  if (l.pricingState === "public" && l.cheapestPrice != null) {
    parts.push(`publishes pricing, from $${l.cheapestPrice}${l.cheapestPeriod ? `/${escapeHtml(l.cheapestPeriod)}` : ""}`);
  } else if (l.pricingState === "sales_led") {
    parts.push("doesn't publish prices (you have to talk to their sales team)");
  }
  if (l.openRoles != null) parts.push(`has ${l.openRoles} open role${l.openRoles === 1 ? "" : "s"}`);
  return parts.length > 0 ? `${domain} ${parts.join(" and ")}.` : null;
}

const P = 'style="color:#3a3a3a;font-size:14px;line-height:1.6;"';

export type SnapshotDripEmail = { subject: string; bodyHtml: string; ctaLabel: string; ctaUrl: string };

export function buildSnapshotDripEmail(
  step: SnapshotDripStep,
  opts: { lookups: SnapshotLookup[]; appUrl: string }
): SnapshotDripEmail {
  const { lookups, appUrl } = opts;
  const phrase = lookedUpPhrase(lookups);

  switch (step) {
    case 1: {
      const findings = lookups
        .slice(-2)
        .map(findingLine)
        .filter((line): line is string => line !== null);
      const list =
        findings.length > 0
          ? `<ul style="color:#3a3a3a;font-size:14px;line-height:1.6;padding-left:20px;">${findings
              .map((line) => `<li>${line}</li>`)
              .join("")}</ul>`
          : "";
      return {
        subject: "Your competitor snapshot, and what comes next",
        bodyHtml: `<p ${P}>You ran a Ripplewatch snapshot on ${phrase} recently, so here's the short version of what it found.</p>
          ${list}
          <p ${P}>That was one look, taken once. Ripplewatch does the same check every day for each competitor you add, and tells you when something changes that matters to your business.</p>`,
        ctaLabel: "See how it works",
        ctaUrl: `${appUrl}/how-it-works`,
      };
    }
    case 2:
      return {
        subject: "How most teams find out a competitor changed their pricing",
        bodyHtml: `<p ${P}>Often it's a prospect who brings it up on a call, or a customer who forwards a screenshot. By then the change can be weeks old.</p>
          <p ${P}>Ripplewatch checks every day, so you hear about it when it happens, with a note on whether it matters for the deals you're actually in.</p>
          <p ${P}>It's $29 a month. If it's not useful in your first 30 days, you get that back, plus any balance you haven't used.</p>`,
        ctaLabel: "See pricing and the refund terms",
        ctaUrl: `${appUrl}/pricing`,
      };
    case 3:
      return {
        subject: "One number per competitor, not a pile of alerts",
        bodyHtml: `<p ${P}>Collecting competitor changes is easy. Knowing which ones to care about is the hard part.</p>
          <p ${P}>So each competitor gets a Momentum score: heating up, steady, or cooling. It rolls up their hiring, pricing, product changes, and press, and it's scored against your positioning and the deals you've won and lost, so the same news can matter a lot to one company and not at all to another.</p>`,
        ctaLabel: "See an example",
        ctaUrl: `${appUrl}/how-it-works`,
      };
    case 4:
      return {
        subject: "Want a quick walkthrough?",
        bodyHtml: `<p ${P}>I'm Jeremy, I run Ripplewatch. We're a small team, so if it would help I'm glad to do a short call, set it up on ${lookups.length > 0 ? phrase : "your competitors"} ahead of time, and show you what it would have caught.</p>
          <p ${P}>Or just reply with a question. I read every one.</p>`,
        ctaLabel: "Book a 30-minute walkthrough",
        ctaUrl: `${appUrl}/contact?topic=demo`,
      };
    case 5:
      return {
        subject: "It's been a month since your snapshot",
        bodyHtml: `<p ${P}>Competitor pages change quietly, so what you saw for ${phrase} a month ago has probably shifted a bit.</p>
          <p ${P}>Ripplewatch can track it for you so you don't have to remember. It's $29 a month plus usage you prepay for, and the 30-day money-back guarantee covers the $29 and anything you haven't used.</p>`,
        ctaLabel: "See pricing",
        ctaUrl: `${appUrl}/pricing`,
      };
    case 6:
      return {
        subject: "Should I stop emailing?",
        bodyHtml: `<p ${P}>This is my last note for now. If competitive intel isn't a priority, no problem, and I won't email again unless you come back.</p>
          <p ${P}>If it is, the 30-day refund means trying it costs you very little. And you can reply to this email any time.</p>`,
        ctaLabel: "See pricing",
        ctaUrl: `${appUrl}/pricing`,
      };
  }
}
