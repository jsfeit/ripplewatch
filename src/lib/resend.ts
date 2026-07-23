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

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `${signals.filter((s) => s.scored).length} scored alert${signals.length === 1 ? "" : "s"} ${noun}`,
    html: renderDigestHtml(companyName, signals, cadence),
  });
}

export async function sendInviteEmail(to: string, inviterCompanyName: string, acceptUrl: string) {
  if (!isResendConfigured()) return;

  await getResend().emails.send({
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
}
