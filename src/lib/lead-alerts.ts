import "server-only";
import { OPERATOR_EMAIL } from "@/lib/followups";
import { sendLeadAlertEmail } from "@/lib/resend";
import { buildLeadAlert, renderLeadAlertHtml, type LeadEvent } from "@/lib/lead-alert-content";

// Your own test signups (the operator and ADMIN_EMAILS, including plus-address
// aliases like you+test@gmail.com) shouldn't email you about yourself.
function isOwnerEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const [local, domain] = lower.split("@");
  const base = `${local.split("+")[0]}@${domain}`;
  const owners = [OPERATOR_EMAIL, ...(process.env.ADMIN_EMAILS ?? "").split(",")]
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  return owners.some((o) => o === lower || o === base);
}

// Tells the operator about a new signup or lead. Never throws and never holds up
// the visitor for long: a failed alert is only logged. Awaited by callers (a
// serverless function can stop right after responding), so it stays quick.
export async function notifyLead(event: LeadEvent): Promise<void> {
  try {
    const who = event.kind === "live_read" ? null : event.email;
    if (who && isOwnerEmail(who)) return;
    const alert = buildLeadAlert(event);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ripplewatch.ai";
    // Visitor-typed text can be in the subject, so no line breaks and a sane length.
    const subject = alert.subject.replace(/[\r\n]+/g, " ").slice(0, 150);
    await sendLeadAlertEmail([OPERATOR_EMAIL], subject, renderLeadAlertHtml(alert, appUrl));
  } catch (err) {
    console.error("lead alert email failed:", err);
  }
}
