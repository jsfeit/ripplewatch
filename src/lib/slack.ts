import "server-only";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import type { SignalType } from "@/lib/supabase/types";

export function getSlackRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`;
}

export function isSlackConfigured(): boolean {
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}

type SlackCredentials = {
  access_token: string;
  incoming_webhook_url: string | null;
  team_id: string;
};

export async function exchangeSlackCode(code: string): Promise<SlackCredentials> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: getSlackRedirectUri(),
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data.error}`);
  }

  return {
    access_token: data.access_token,
    incoming_webhook_url: data.incoming_webhook?.url ?? null,
    team_id: data.team?.id,
  };
}

// Priority-style palette (red/amber/gray), not the app's own brand teal —
// this is a Slack alert, where color communicates urgency the way it does
// in any monitoring/paging tool, not the product's visual identity. Matches
// Slack's own brand colors where convenient so it looks native to the
// client rather than like an arbitrary hex pulled from our own palette.
const LEVEL_STYLE: Record<string, { color: string; emoji: string }> = {
  High: { color: "#E01E5A", emoji: "🔴" },
  Medium: { color: "#ECB22E", emoji: "🟡" },
  Low: { color: "#8D8D8D", emoji: "⚪" },
};

// Slack only continues the ">" blockquote styling for lines that each
// individually start with "> " — a single leading "> " on a multi-line
// string only quotes the first line, so long reasoning text would render
// with an unstyled tail. Prefixing every line (mrkdwn text has no other
// meaning for a bare newline) fixes that regardless of length.
function blockquote(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

export async function sendSlackAlert(
  credentials: SlackCredentials,
  message: {
    competitorName: string;
    title: string;
    url: string | null;
    reasoning: string;
    relevanceLevel: string;
    type: SignalType;
  }
): Promise<void> {
  if (!credentials.incoming_webhook_url) return;

  const style = LEVEL_STYLE[message.relevanceLevel] ?? LEVEL_STYLE.Low;
  const typeLabel = SIGNAL_TYPE_LABELS[message.type] ?? message.type;

  // Mirrors the News feed's AlertCard: the headline itself is the link to
  // the source article (Slack mrkdwn <url|text>), not a bare domain name
  // that Slack happens to auto-linkify to the site's homepage. Falls back
  // to plain text on the rare signal with no url rather than dropping the
  // headline.
  const headline = message.url ? `<${message.url}|*${message.title}*>` : `*${message.title}*`;

  const blocks: Record<string, unknown>[] = [
    { type: "header", text: { type: "plain_text", text: message.competitorName, emoji: true } },
    {
      type: "section",
      text: { type: "mrkdwn", text: `${style.emoji} *${message.relevanceLevel} relevance* · ${typeLabel}` },
    },
    { type: "section", text: { type: "mrkdwn", text: headline } },
  ];

  if (message.reasoning) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: blockquote(message.reasoning) } });
  }

  if (message.url) {
    blocks.push({
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "View source", emoji: true }, url: message.url },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "Sent by <https://ripplewatch.ai|Ripplewatch>" }],
  });

  // Block Kit blocks nested inside a legacy "attachments" entry is still
  // the only way to get the colored left-edge bar in Slack — a top-level
  // blocks array (no attachments wrapper) can't do it. The bar is what
  // makes relevance level scannable at a glance in a busy channel, so it's
  // worth keeping this one "legacy" field around it.
  await fetch(credentials.incoming_webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Fallback for notifications/screen readers that only read `text`,
      // not the rich blocks.
      text: `${message.relevanceLevel} relevance alert on ${message.competitorName}: ${message.title}`,
      attachments: [{ color: style.color, blocks }],
    }),
  });
}

export type SlackWeeklyDigestInput = {
  accountName: string;
  verdict: string | null;
  trendsDigest: string | null;
  highCount: number;
  mediumCount: number;
  dashboardUrl: string;
};

// This is the one Slack message every account is guaranteed to get every
// week, whether or not anything urgent happened — so unlike sendSlackAlert
// (which only fires when there's something to react to) it always has to
// land as worth opening: real synthesis up top (the verdict, the momentum
// read), not a bare "3 new signals, click to view" that just pushes the
// actual thinking behind a link.
export async function sendSlackWeeklyDigest(
  credentials: SlackCredentials,
  input: SlackWeeklyDigestInput
): Promise<void> {
  if (!credentials.incoming_webhook_url) return;

  const hasActivity = input.highCount + input.mediumCount > 0;

  const blocks: Record<string, unknown>[] = [
    { type: "header", text: { type: "plain_text", text: `This week at ${input.accountName}`, emoji: true } },
  ];

  if (input.verdict) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*The verdict*\n${blockquote(input.verdict)}` } });
  }
  if (input.trendsDigest) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Momentum*\n${blockquote(input.trendsDigest)}` } });
  }
  // A quiet week with nothing scored is real signal too ("you're covered,
  // nothing needs you"), not a reason to skip the send or leave a blank
  // section pretending a verdict ran when the underlying week had nothing
  // to synthesize.
  if (!input.verdict && !input.trendsDigest) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: hasActivity
          ? "Signals came in this week, but nothing rose to a clear verdict yet — the dashboard has the raw feed."
          : "Quiet week — nothing scored High or Medium relevance. Nothing needs your attention right now.",
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `${input.highCount} high · ${input.mediumCount} medium relevance this week` }],
  });
  blocks.push({
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "Open dashboard", emoji: true }, url: input.dashboardUrl, style: "primary" },
    ],
  });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "Sent by <https://ripplewatch.ai|Ripplewatch> · weekly recap" }],
  });

  await fetch(credentials.incoming_webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Fallback for notifications/screen readers — the verdict itself
      // when there is one, not just an announcement that a digest exists.
      text: input.verdict ? `This week at ${input.accountName}: ${input.verdict}` : `This week at ${input.accountName}`,
      blocks,
    }),
  });
}
