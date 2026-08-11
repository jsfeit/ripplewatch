import "server-only";

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

export async function sendSlackAlert(
  credentials: SlackCredentials,
  message: { competitorName: string; title: string; url: string | null; reasoning: string; relevanceLevel: string }
): Promise<void> {
  if (!credentials.incoming_webhook_url) return;

  // Mirrors the News feed's AlertCard: the headline itself is the link to
  // the source article (Slack mrkdwn <url|text>), not a bare domain name
  // that Slack happens to auto-linkify to the site's homepage. Falls back
  // to plain text on the rare signal with no url rather than dropping the
  // headline.
  const headline = message.url ? `<${message.url}|${message.title}>` : message.title;

  await fetch(credentials.incoming_webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${message.relevanceLevel} relevance alert on ${message.competitorName}*\n${headline}\n${message.reasoning}`,
    }),
  });
}
