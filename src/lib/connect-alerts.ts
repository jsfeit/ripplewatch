// The daily alert for Connect accounts: one email on a day when something
// scored High relevance changed at a tracked competitor, and nothing on quiet
// days. Pure content builder; the cron picks the signals and sends. No model
// call: the relevance reasoning was written when the signal was scored.
import type { ConnectDailyAlertEmail } from "@/lib/resend";

export type AlertSignal = { competitor: string; title: string; why: string | null };

const MAX_ITEMS = 5;

export function buildDailyAlertEmail(companyName: string, signals: AlertSignal[]): ConnectDailyAlertEmail | null {
  if (signals.length === 0) return null;
  const items = signals.slice(0, MAX_ITEMS);
  const more = signals.length - items.length;
  const names = [...new Set(items.map((s) => s.competitor))];
  const top = items[0];

  return {
    subject:
      signals.length === 1
        ? `High-relevance change at ${top.competitor}`
        : `${signals.length} high-relevance changes: ${names.slice(0, 2).join(", ")}${names.length > 2 ? " and more" : ""}`,
    headline: `Worth your attention today, ${companyName}`,
    items,
    moreCount: more > 0 ? more : 0,
    tryAsking: `Should we respond to this change at ${top.competitor}: "${top.title.replace(/[.!?]+$/, "")}"?`,
  };
}
