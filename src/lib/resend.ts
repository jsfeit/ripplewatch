import "server-only";
import { Resend } from "resend";

let cachedClient: Resend | null = null;

function getResend(): Resend {
  if (!cachedClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    cachedClient = new Resend(process.env.RESEND_API_KEY);
  }
  return cachedClient;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

// Alerts (the digest emails customers actually signed up to receive, plus
// internal uptime pages) send from a distinct address from everything else
// — welcome/invite/campaign/billing mail reads as "the company," alerts
// read as "the monitoring system." Falls back to the general address so a
// deploy isn't broken if only RESEND_FROM_EMAIL is set.
function getAlertsFromEmail(): string {
  return process.env.RESEND_ALERTS_FROM_EMAIL || process.env.RESEND_FROM_EMAIL!;
}

export type DigestSignal = {
  competitorName: string;
  title: string;
  scored: boolean;
  relevanceLevel?: string | null;
  relevanceReasoning?: string | null;
};

export type DigestCadence = "daily" | "weekly";

const CADENCE_COPY: Record<DigestCadence, { eyebrow: string; noun: string }> = {
  daily: { eyebrow: "Today in your competitive landscape", noun: "today" },
  weekly: { eyebrow: "The quieter signals from this week", noun: "this week" },
};

function renderDigestHtml(companyName: string, signals: DigestSignal[], cadence: DigestCadence): string {
  const rows = signals
    .map((s) => {
      if (s.scored) {
        return `<div style="border:1px solid #b9dfd9;background:#effaf8;border-radius:8px;padding:12px;margin-bottom:8px;">
          <p style="margin:0;font-weight:600;">${s.competitorName} · ${s.title}</p>
          <p style="margin:4px 0 0;color:#3a3a3a;font-size:14px;">${s.relevanceLevel} relevance — ${s.relevanceReasoning ?? ""}</p>
        </div>`;
      }
      return `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px;margin-bottom:8px;color:#666;">
        ${s.competitorName} · ${s.title}
      </div>`;
    })
    .join("");

  const scoredCount = signals.filter((s) => s.scored).length;
  const { eyebrow } = CADENCE_COPY[cadence];

  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
    <p style="color:#888;font-size:13px;">${eyebrow}</p>
    <h2 style="margin:4px 0 16px;">${signals.length} signals, ${scoredCount} worth acting on</h2>
    ${rows}
    <p style="color:#888;font-size:12px;margin-top:24px;">— Ripplewatch, for ${companyName}</p>
  </div>`;
}

// cadence only changes copy/subject — the caller decides which signals
// belong in a daily vs. weekly send (see the two digest cron routes).
export async function sendDigestEmail(
  to: string,
  companyName: string,
  signals: DigestSignal[],
  cadence: DigestCadence = "daily"
) {
  if (!isResendConfigured() || signals.length === 0) return;

  const { noun } = CADENCE_COPY[cadence];

  const result = await getResend().emails.send({
    from: getAlertsFromEmail(),
    to,
    subject: `${signals.filter((s) => s.scored).length} scored alert${signals.length === 1 ? "" : "s"} ${noun}`,
    html: renderDigestHtml(companyName, signals, cadence),
  });
  if (result.error) throw new Error(result.error.message);
}

// Marketing campaigns (waitlist notify, launch announcement) — distinct
// from the transactional sends above. Body is already-personalized HTML;
// callers build that via lib/campaigns.ts's personalize() first.
export async function sendCampaignEmail(to: string, subject: string, html: string) {
  if (!isResendConfigured()) throw new Error("RESEND_API_KEY/RESEND_FROM_EMAIL not configured.");

  const result = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject,
    html,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data?.id ?? null;
}

// "Signed up, never finished checkout" sequence — every tier requires
// payment (no free plan), and the account is fully created and usable
// before the Stripe redirect even happens, so abandoning that step today
// leaves a customer with permanent free access and zero follow-up. Two
// steps, sent by /api/cron/payment-reminders; each is generic about which
// plan they were on since that's not reliably known pre-payment.
export async function sendPaymentReminderEmail(
  to: string,
  companyName: string,
  step: 1 | 2,
  appUrl: string
) {
  if (!isResendConfigured()) return;

  const settingsUrl = `${appUrl}/app/settings`;
  const subject =
    step === 1
      ? "You're one step from real competitive alerts"
      : "Still want Ripplewatch tracking your competitors?";

  const body =
    step === 1
      ? `<p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
          You set up ${companyName} on Ripplewatch, but checkout never finished — nothing's actively
          monitoring your competitors until a plan is active.
        </p>
        <p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
          Every plan comes with a 30-day money-back guarantee, so there's no real risk in finishing now.
        </p>`
      : `<p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
          No pressure — just checking in one more time. Your account's ready whenever you are, but
          competitors aren't being monitored until a plan is active.
        </p>
        <p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
          If now isn't the right time, no worries at all. If it is, it takes about a minute.
        </p>`;

  const result = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">${subject}</h2>
      ${body}
      <a href="${settingsUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#0f5f56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Finish setting up your plan
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        Questions? Just reply — a person reads every one.
      </p>
    </div>`,
  });
  if (result.error) throw new Error(result.error.message);
}

// Distinct from the transactional digest/invite emails above — a one-time
// send right after onboarding completes, so a new signup doesn't churn
// before their first real (scored) signal shows up days later.
export async function sendWelcomeEmail(to: string, companyName: string, appUrl: string) {
  if (!isResendConfigured()) return;

  const result = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: "Welcome to Ripplewatch — here's how to get value this week",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">You're set up, ${companyName}.</h2>
      <p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
        Your dashboard has a sample scored alert right now — that's a placeholder built from your own
        positioning and competitors, not a real signal yet. Real ones start showing up once the next
        scheduled crawl runs.
      </p>
      <p style="color:#3a3a3a;font-size:14px;line-height:1.6;"><strong>Three things worth doing this week:</strong></p>
      <ol style="color:#3a3a3a;font-size:14px;line-height:1.7;padding-left:20px;">
        <li>Connect Slack so alerts land where your team already works, instead of waiting on email.</li>
        <li>Add any remaining competitors you're tracking — the more context, the sharper the scoring.</li>
        <li>Try Ask — it's scoped to your own competitors and business context, so you can ask something
          like "what's changed with our top competitor recently?" instead of waiting for an alert.</li>
      </ol>
      <a href="${appUrl}/app/dashboard" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0f5f56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Go to your dashboard
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        Questions? Just reply — a person reads every one.
      </p>
    </div>`,
  });
  if (result.error) throw new Error(result.error.message);
}

// Fired by /api/cron/uptime-check on a failed health check. Deliberately
// plain text, no styling — this is an operational alert, not a customer
// email, and needs to render instantly in any inbox.
export async function sendUptimeAlertEmail(to: string[], detail: string) {
  if (!isResendConfigured() || to.length === 0) return;

  const result = await getResend().emails.send({
    from: getAlertsFromEmail(),
    to,
    subject: "🔴 Ripplewatch health check failed",
    html: `<p>The scheduled health check against <code>${process.env.NEXT_PUBLIC_APP_URL}</code> just failed.</p>
      <p>${detail}</p>
      <p style="color:#888;font-size:12px;">Sent by /api/cron/uptime-check.</p>`,
  });
  if (result.error) throw new Error(result.error.message);
}

export type CostAlertAccount = { name: string; tier: string; tierPriceUsd: number; expectedUsd: number; actualUsd: number };

// Fired by /api/cron/cost-alert when an account's LLM spend this calendar
// month is running well ahead of what its tier price budgets for. Internal
// admin alert, not a customer email — same treatment as sendUptimeAlertEmail.
export async function sendCostAlertEmail(to: string[], accounts: CostAlertAccount[]) {
  if (!isResendConfigured() || to.length === 0 || accounts.length === 0) return;

  const rows = accounts
    .map(
      (a) =>
        `<tr><td style="padding:4px 10px 4px 0">${a.name}</td><td style="padding:4px 10px">${a.tier}</td><td style="padding:4px 10px">$${a.expectedUsd.toFixed(2)}</td><td style="padding:4px 0">$${a.actualUsd.toFixed(2)}</td></tr>`
    )
    .join("");

  const result = await getResend().emails.send({
    from: getAlertsFromEmail(),
    to,
    subject: `⚠️ ${accounts.length} account${accounts.length === 1 ? "" : "s"} over LLM cost budget this month`,
    html: `<p>These accounts' estimated LLM spend this calendar month is running well ahead of what their tier price budgets for (pro-rated by day-of-month elapsed):</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr style="text-align:left;color:#888"><th style="padding:4px 10px 4px 0">Account</th><th style="padding:4px 10px">Tier</th><th style="padding:4px 10px">Expected so far</th><th style="padding:4px 0">Actual</th></tr>
        ${rows}
      </table>
      <p style="color:#888;font-size:12px;">Sent by /api/cron/cost-alert. See Admin → Accounts for the full breakdown.</p>`,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function sendInviteEmail(to: string, inviterCompanyName: string, acceptUrl: string) {
  if (!isResendConfigured()) return;

  const result = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `You've been invited to ${inviterCompanyName}'s Ripplewatch workspace`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">Join ${inviterCompanyName} on Ripplewatch</h2>
      <p style="color:#3a3a3a;font-size:14px;line-height:1.5;">
        You've been invited to join their competitive intelligence workspace.
      </p>
      <a href="${acceptUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0f5f56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Accept invite
      </a>
    </div>`,
  });
  if (result.error) throw new Error(result.error.message);
}
