import "server-only";
import { OPERATOR_EMAIL } from "@/lib/followups";
import { sendLeadAlertEmail } from "@/lib/resend";
import { buildLeadAlert, renderLeadAlertHtml, type LeadEvent } from "@/lib/lead-alert-content";

// Tells the operator about every signup, lead, payment, live read and contact
// message, including the operator's own tests: nothing is filtered out. Never
// throws and never holds up the visitor for long: a failed alert is only
// logged. Returns whether the email actually went out, so a caller that has
// no other record (the contact form) can tell. Awaited by callers (a
// serverless function can stop right after responding), so it stays quick.
export async function notifyLead(event: LeadEvent): Promise<boolean> {
  try {
    const alert = buildLeadAlert(event);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ripplewatch.ai";
    // Visitor-typed text can be in the subject, so no line breaks and a sane length.
    const subject = alert.subject.replace(/[\r\n]+/g, " ").slice(0, 150);
    // A contact request is a person waiting on an answer: replying to the alert goes to them.
    const replyTo = event.kind === "contact_request" ? event.email : undefined;
    return await sendLeadAlertEmail([OPERATOR_EMAIL], subject, renderLeadAlertHtml(alert, appUrl), replyTo);
  } catch (err) {
    console.error("lead alert email failed:", err);
    return false;
  }
}
