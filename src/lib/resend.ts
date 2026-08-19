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

// Display name wrapper — without one, recipients just see the bare
// address in their inbox. General mail (welcome/invite/campaign/billing)
// reads as "the company"; alerts read as "the monitoring system."
function getFromEmail(): string {
  return `Hello from Ripplewatch AI <${process.env.RESEND_FROM_EMAIL!}>`;
}

// Falls back to the general address so a deploy isn't broken if only
// RESEND_FROM_EMAIL is set.
function getAlertsFromEmail(): string {
  return process.env.RESEND_ALERTS_FROM_EMAIL
    ? `Alerts from Ripplewatch AI <${process.env.RESEND_ALERTS_FROM_EMAIL}>`
    : getFromEmail();
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

const RELEVANCE_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function digestSignalRank(s: DigestSignal): number {
  if (!s.scored || !s.relevanceLevel) return 3;
  return RELEVANCE_RANK[s.relevanceLevel] ?? 3;
}

function renderDigestHtml(
  companyName: string,
  signals: DigestSignal[],
  cadence: DigestCadence,
  verdict?: string | null
): string {
  const rows = [...signals]
    .sort((a, b) => digestSignalRank(a) - digestSignalRank(b))
    .map((s) => {
      if (s.scored) {
        return `<div style="border:1px solid #b9dfd9;background:#effaf8;border-radius:8px;padding:12px;margin-bottom:8px;">
          <p style="margin:0;font-weight:600;">${s.competitorName} · ${s.title}</p>
          <p style="margin:4px 0 0;color:#3a3a3a;font-size:14px;">${s.relevanceLevel} relevance: ${s.relevanceReasoning ?? ""}</p>
        </div>`;
      }
      return `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:12px;margin-bottom:8px;color:#666;">
        ${s.competitorName} · ${s.title}
      </div>`;
    })
    .join("");

  const scoredCount = signals.filter((s) => s.scored).length;
  const { eyebrow } = CADENCE_COPY[cadence];

  // The verdict is a synthesis across the whole batch (see
  // generateDigestVerdict) — rendered above the itemized list, visually
  // distinct, so it reads as the takeaway rather than one more item.
  const verdictHtml = verdict
    ? `<div style="border:1px solid #b9dfd9;background:#effaf8;border-radius:8px;padding:14px;margin-bottom:16px;">
        <p style="margin:0;color:#0f5c52;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">The takeaway</p>
        <p style="margin:6px 0 0;color:#1a1a1a;font-size:14px;line-height:1.5;">${verdict}</p>
      </div>`
    : "";

  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
    <p style="color:#888;font-size:13px;">${eyebrow}</p>
    <h2 style="margin:4px 0 16px;">${signals.length} signals, ${scoredCount} worth acting on</h2>
    ${verdictHtml}
    ${rows}
    <p style="color:#888;font-size:12px;margin-top:24px;">Ripplewatch, for ${companyName}</p>
  </div>`;
}

// cadence only changes copy/subject — the caller decides which signals
// belong in a daily vs. weekly send (see the two digest cron routes).
// verdict is optional: the daily cron generates one fresh each send, the
// weekly cron passes the same stored value it also puts on the dashboard
// banner (see accounts.weekly_verdict) rather than generating it twice.
export async function sendDigestEmail(
  to: string,
  companyName: string,
  signals: DigestSignal[],
  cadence: DigestCadence = "daily",
  verdict?: string | null
) {
  if (!isResendConfigured() || signals.length === 0) return;

  const { noun } = CADENCE_COPY[cadence];

  const result = await getResend().emails.send({
    from: getAlertsFromEmail(),
    to,
    subject: `${signals.filter((s) => s.scored).length} scored alert${signals.length === 1 ? "" : "s"} ${noun}`,
    html: renderDigestHtml(companyName, signals, cadence, verdict),
  });
  if (result.error) throw new Error(result.error.message);
}

// Marketing campaigns (leads follow-up, launch announcement) — distinct
// from the transactional sends above. Body is already-personalized HTML;
// callers build that via lib/campaigns.ts's personalize() first.
export async function sendCampaignEmail(to: string, subject: string, html: string) {
  if (!isResendConfigured()) throw new Error("RESEND_API_KEY/RESEND_FROM_EMAIL not configured.");

  const result = await getResend().emails.send({
    from: getFromEmail(),
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
          You set up ${companyName} on Ripplewatch, but checkout never finished; nothing's actively
          monitoring your competitors until a plan is active.
        </p>
        <p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
          Every plan comes with a 30-day money-back guarantee, so there's no real risk in finishing now.
        </p>`
      : `<p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
          No pressure, just checking in one more time. Your account's ready whenever you are, but
          competitors aren't being monitored until a plan is active.
        </p>
        <p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
          If now isn't the right time, no worries at all. If it is, it takes about a minute.
        </p>`;

  const result = await getResend().emails.send({
    from: getFromEmail(),
    to,
    subject,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">${subject}</h2>
      ${body}
      <a href="${settingsUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#0f5f56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Finish setting up your plan
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        Questions? Just reply; a person reads every one.
      </p>
    </div>`,
  });
  if (result.error) throw new Error(result.error.message);
}

const TIER_DISPLAY_NAMES: Record<string, string> = { starter: "Starter", plus: "Plus", advanced: "Advanced" };
const TIER_RANK: Record<string, number> = { starter: 0, plus: 1, advanced: 2 };

// Fired by the customer.subscription.updated webhook handler whenever a
// tier switch actually lands (comparing the account's tier before vs.
// after the update) — never on the very first subscription creation,
// which the welcome email already covers.
export async function sendPlanChangeEmail(to: string, fromTier: string, toTier: string, appUrl: string) {
  if (!isResendConfigured()) return;

  const isUpgrade = (TIER_RANK[toTier] ?? 0) > (TIER_RANK[fromTier] ?? 0);
  const fromName = TIER_DISPLAY_NAMES[fromTier] ?? fromTier;
  const toName = TIER_DISPLAY_NAMES[toTier] ?? toTier;
  const subject = isUpgrade
    ? `You're now on the ${toName} plan`
    : `Your plan is switching to ${toName}`;
  const settingsUrl = `${appUrl}/app/settings`;

  const body = isUpgrade
    ? `<p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
        Your plan changed from ${fromName} to ${toName}, effective immediately; the difference was charged
        on a prorated basis, and your new limits are active now.
      </p>`
    : `<p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
        Your plan is moving from ${fromName} to ${toName}. Since this is a downgrade, you'll keep your
        current ${fromName} access through the end of the period you already paid for; the switch to
        ${toName} takes effect at your next billing date, not immediately.
      </p>`;

  const result = await getResend().emails.send({
    from: getFromEmail(),
    to,
    subject,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">${subject}</h2>
      ${body}
      <a href="${settingsUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#0f5f56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        View billing
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        Questions? Just reply; a person reads every one.
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
    from: getFromEmail(),
    to,
    subject: "Welcome to Ripplewatch: here's how to get value this week",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">You're set up, ${companyName}.</h2>
      <p style="color:#3a3a3a;font-size:14px;line-height:1.6;">
        Your dashboard has a sample scored alert right now; that's a placeholder built from your own
        positioning and competitors, not a real signal yet. Real ones start showing up once the next
        scheduled crawl runs.
      </p>
      <p style="color:#3a3a3a;font-size:14px;line-height:1.6;"><strong>Three things worth doing this week:</strong></p>
      <ol style="color:#3a3a3a;font-size:14px;line-height:1.7;padding-left:20px;">
        <li>Connect Slack so alerts land where your team already works, instead of waiting on email.</li>
        <li>Add any remaining competitors you're tracking: the more context, the sharper the scoring.</li>
        <li>Try Ask: it's scoped to your own competitors and business context, so you can ask something
          like "what's changed with our top competitor recently?" instead of waiting for an alert.</li>
      </ol>
      <a href="${appUrl}/app/dashboard" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0f5f56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Go to your dashboard
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        Questions? Just reply; a person reads every one.
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

// Fired by maybeAlertCreditExhaustion (anthropic.ts) the first time an
// Anthropic API call fails with a low-credit-balance error, deduped via
// system_alerts so a burst of failing calls (every scoring/scraping call in
// a crawl, in practice) sends one email, not dozens. Internal ops alert,
// same treatment as sendCostAlertEmail.
export async function sendAnthropicCreditAlertEmail(to: string[]) {
  if (!isResendConfigured() || to.length === 0) return;

  const result = await getResend().emails.send({
    from: getAlertsFromEmail(),
    to,
    subject: "⚠️ Anthropic API credit balance is too low",
    html: `<p>Anthropic just rejected a request with:</p>
      <blockquote style="border-left:3px solid #ddd;margin:8px 0;padding-left:12px;color:#555;">Your credit balance is too low to access the Anthropic API. Please go to Plans &amp; Billing to upgrade or purchase credits.</blockquote>
      <p>Every scoring, scraping-extraction, digest, and trends call is failing until this is resolved. Add credits or check auto-reload at <a href="https://console.anthropic.com">console.anthropic.com</a> → Settings → Billing.</p>
      <p style="color:#888;font-size:12px;">Further alerts are suppressed for a while after this one so a burst of failures doesn't flood this inbox.</p>`,
  });
  if (result.error) throw new Error(result.error.message);
}

// Fired by the webhook's invoice.payment_succeeded case — every actual
// charge, first payment and every renewal alike (checkout.session.completed
// only fires once, at the very first checkout; recurring renewals bill
// through an invoice with no new checkout session). Internal alert to
// ADMIN_EMAILS, not a customer receipt — Stripe already emails the customer
// their own receipt separately.
export async function sendPaymentReceivedEmail(
  to: string[],
  details: { accountName: string; tier: string; amountUsd: number; currency: string }
) {
  if (!isResendConfigured() || to.length === 0) return;

  const amount = `${details.amountUsd.toFixed(2)} ${details.currency.toUpperCase()}`;
  const result = await getResend().emails.send({
    from: getAlertsFromEmail(),
    to,
    subject: `💳 Payment received: ${amount} from ${details.accountName}`,
    html: `<p><strong>${details.accountName}</strong> (${details.tier}) just paid <strong>${amount}</strong>.</p>
      <p style="color:#888;font-size:12px;">Sent by the Stripe webhook on invoice.payment_succeeded. See Admin → Accounts for details.</p>`,
  });
  if (result.error) throw new Error(result.error.message);
}

// Replaces Supabase Auth's own default recovery email (generic "Supabase
// Auth" sender, unbranded copy) — the route calling this generates the
// reset link via the admin API's generateLink() instead of
// resetPasswordForEmail(), which would otherwise trigger Supabase's built-in
// send and bypass Resend entirely.
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!isResendConfigured()) return;

  const result = await getResend().emails.send({
    from: getFromEmail(),
    to,
    subject: "Reset your Ripplewatch password",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">Reset your password</h2>
      <p style="color:#3a3a3a;font-size:14px;line-height:1.5;">
        We received a request to reset the password for your Ripplewatch account. Click below to
        choose a new one. This link expires in an hour.
      </p>
      <a href="${resetUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0f5f56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Reset password
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px;">
        If you didn't request this, you can safely ignore this email; your password won't change.
      </p>
    </div>`,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function sendInviteEmail(to: string, inviterCompanyName: string, acceptUrl: string) {
  if (!isResendConfigured()) return;

  const result = await getResend().emails.send({
    from: getFromEmail(),
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
