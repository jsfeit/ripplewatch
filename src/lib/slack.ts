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
  message: { competitorName: string; title: string; reasoning: string; relevanceLevel: string }
): Promise<void> {
  if (!credentials.incoming_webhook_url) return;

  await fetch(credentials.incoming_webhook_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${message.relevanceLevel} relevance alert on ${message.competitorName}*\n${message.title}\n${message.reasoning}`,
    }),
  });
}
