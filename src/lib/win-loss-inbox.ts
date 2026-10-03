import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// The email-in address for deal history. The bare form is winloss+<accountId>,
// which anyone who learns an account id could mail. The signed form appends a
// token only the server can make: winloss+<accountId>.<token>. The token is
// optional on purpose: addresses already in use keep working until
// WINLOSS_REQUIRE_TOKEN=1 is set, and the app only ever shows the signed one.
const DOMAIN = "in.ripplewatch.ai";

function sign(accountId: string): string {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not configured.");
  return createHmac("sha256", secret).update(`winloss-inbox:${accountId}`).digest("hex").slice(0, 16);
}

export function winLossInboxAddress(accountId: string): string {
  try {
    return `winloss+${accountId}.${sign(accountId)}@${DOMAIN}`;
  } catch {
    return `winloss+${accountId}@${DOMAIN}`;
  }
}

export const INBOX_PATTERN = /^winloss\+([0-9a-f-]{36})(?:\.([0-9a-f]{16}))?@in\.ripplewatch\.ai$/i;

// Whether mail to this recipient should be accepted for the account.
export function inboxTokenAccepted(accountId: string, token: string | undefined): boolean {
  if (!token) return process.env.WINLOSS_REQUIRE_TOKEN !== "1";
  try {
    const expected = Buffer.from(sign(accountId));
    const given = Buffer.from(token.toLowerCase());
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
