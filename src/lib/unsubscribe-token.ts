import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Signs an account id so an onboarding-email unsubscribe link can't be
// forged for someone else's account. The secret is the cron secret, which
// already exists only on the server.
function sign(accountId: string): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not configured.");
  return createHmac("sha256", secret).update(`onboarding-unsub:${accountId}`).digest("hex").slice(0, 32);
}

export function accountUnsubscribeUrl(appUrl: string, accountId: string): string {
  return `${appUrl}/unsubscribe?account=${accountId}&sig=${sign(accountId)}`;
}

export function verifyAccountUnsubscribe(accountId: string, sig: string): boolean {
  try {
    const expected = Buffer.from(sign(accountId));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
