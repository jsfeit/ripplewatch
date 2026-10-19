// What each "someone just signed up" email says. Kept free of server-only imports
// so the wording can be checked on its own. Every value ends up in HTML, so
// everything that came from a visitor is escaped here, not by the caller.
export type LeadEvent =
  | { kind: "account_created"; accountId: string; email: string | null; companyName: string; method: string }
  | { kind: "payment"; accountId: string; email: string | null; companyName: string; amountUsd: number | null }
  | {
      kind: "lead_captured";
      email: string;
      source: string;
      company: string | null;
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      detail: string | null;
    }
  | {
      kind: "live_read";
      company: string | null;
      positioning: string;
      icp: string | null;
      competitor: string;
      confidence: "evidence" | "thin" | null;
      found: string | null;
    }
  | {
      kind: "contact_request";
      name: string;
      email: string;
      company: string | null;
      topic: string;
      message: string;
    };

export type LeadAlert = { subject: string; rows: [string, string][]; linkLabel: string; linkPath: string };

const SOURCE_LABEL: Record<string, string> = {
  snapshot: "Free competitor snapshot",
  quiz: "Competitive intelligence quiz",
  blog: "Blog newsletter form",
  onboarding: "Signup form (first step)",
  connect: "Connect interest form",
};

function or(value: string | null | undefined, fallback = "(not given)"): string {
  return value?.trim() ? value.trim() : fallback;
}

export function buildLeadAlert(e: LeadEvent): LeadAlert {
  switch (e.kind) {
    case "account_created":
      return {
        subject: `New signup: ${e.companyName}${e.email ? ` (${e.email})` : ""}`,
        rows: [
          ["Company", e.companyName],
          ["Email", or(e.email)],
          ["Signed up with", e.method],
          ["Status", "Account created, not paid yet"],
        ],
        linkLabel: "Open the account",
        linkPath: `/admin/accounts/${e.accountId}`,
      };
    case "payment":
      return {
        subject: `Paid: ${e.companyName}${e.amountUsd !== null ? ` ($${e.amountUsd.toFixed(2)})` : ""}`,
        rows: [
          ["Company", e.companyName],
          ["Email", or(e.email)],
          ["Paid today", e.amountUsd !== null ? `$${e.amountUsd.toFixed(2)}` : "(amount unavailable)"],
          ["Status", "Live"],
        ],
        linkLabel: "Open the account",
        linkPath: `/admin/accounts/${e.accountId}`,
      };
    case "lead_captured": {
      const utm = [e.utmSource, e.utmMedium, e.utmCampaign].filter(Boolean).join(" / ");
      const rows: [string, string][] = [
        ["Email", e.email],
        ["Came in through", SOURCE_LABEL[e.source] ?? e.source],
        ["Company", or(e.company)],
      ];
      if (e.detail) rows.push(["Details", e.detail]);
      rows.push(["Campaign", or(utm, "(none)")]);
      return {
        subject: `New lead: ${e.email} (${SOURCE_LABEL[e.source] ?? e.source})`,
        rows,
        linkLabel: "Open leads",
        linkPath: "/admin/users?show=leads",
      };
    }
    case "contact_request":
      return {
        subject: `Contact (${e.topic}): ${e.name}`,
        rows: [
          ["Topic", e.topic],
          ["Name", e.name],
          ["Email", e.email],
          ["Company", or(e.company)],
          ["Message", or(e.message, "(none)")],
        ],
        linkLabel: "Open leads",
        linkPath: "/admin/users?show=leads",
      };
    case "live_read":
      return {
        subject: `Live read: ${or(e.company, "someone")} on ${e.competitor}`,
        rows: [
          ["Company they typed", or(e.company)],
          ["What they sell", e.positioning],
          ["Who buys it", or(e.icp)],
          ["Competitor", e.competitor],
          ["Read", e.confidence === null ? "No read produced" : e.confidence === "thin" ? "Thin" : "Evidence"],
          ["What it found", or(e.found, "(none)")],
        ],
        linkLabel: "Open live reads",
        linkPath: "/admin/live-reads",
      };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderLeadAlertHtml(alert: LeadAlert, appUrl: string): string {
  const rows = alert.rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#666;font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;color:#1a1a1a;">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
    <table style="border-collapse:collapse;width:100%;">${rows}</table>
    <p style="margin-top:18px;"><a href="${escapeHtml(appUrl + alert.linkPath)}" style="display:inline-block;padding:9px 16px;background:#0f5f56;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(alert.linkLabel)}</a></p>
  </div>`;
}
