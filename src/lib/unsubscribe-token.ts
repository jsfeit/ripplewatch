import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Which emails a link opts out of. "onboarding" is the original list and its
// links carry no `list` parameter, so ones already sent keep working.
export type UnsubscribeList = "onboarding" | "daily" | "monthly";

export function parseUnsubscribeList(value: string | undefined): UnsubscribeList {
  return value === "daily" || value === "monthly" ? value : "onboarding";
}

// Signs an account id (per list) so an unsubscribe link can't be forged for
// someone else's account, or reused to opt out of a different list. The
// secret is the cron secret, which already exists only on the server.
function sign(accountId: string, list: UnsubscribeList): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not configured.");
  const label = list === "onboarding" ? "onboarding-unsub" : `connect-unsub:${list}`;
  return createHmac("sha256", secret).update(`${label}:${accountId}`).digest("hex").slice(0, 32);
}

export function accountUnsubscribeUrl(appUrl: string, accountId: string, list: UnsubscribeList = "onboarding"): string {
  const listParam = list === "onboarding" ? "" : `&list=${list}`;
  return `${appUrl}/unsubscribe?account=${accountId}&sig=${sign(accountId, list)}${listParam}`;
}

export function verifyAccountUnsubscribe(accountId: string, sig: string, list: UnsubscribeList = "onboarding"): boolean {
  try {
    const expected = Buffer.from(sign(accountId, list));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
