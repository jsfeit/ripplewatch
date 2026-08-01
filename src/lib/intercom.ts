import "server-only";

export function getIntercomRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/intercom/callback`;
}

export function isIntercomConfigured(): boolean {
  return Boolean(process.env.INTERCOM_CLIENT_ID && process.env.INTERCOM_CLIENT_SECRET);
}

type IntercomCredentials = {
  access_token: string;
};

// Intercom's "Eagle" token endpoint takes client_id/client_secret/code as a
// JSON body (not Basic auth like Gong/Zoom, not form-encoded like HubSpot),
// and returns the token under the key "token" rather than "access_token".
// Unlike those three, Intercom access tokens don't expire, so there's no
// refresh_token/expires_at to track here.
export async function exchangeIntercomCode(code: string): Promise<IntercomCredentials> {
  const res = await fetch("https://api.intercom.io/auth/eagle/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: process.env.INTERCOM_CLIENT_ID,
      client_secret: process.env.INTERCOM_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Intercom OAuth exchange failed: ${res.status}`);
  }

  const data = await res.json();
  return { access_token: data.token };
}

// Strips HTML tags/entities from a conversation's rich-text body, leaving
// plain text — Intercom returns conversation content as HTML, not markdown.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Pulls the most recent conversations' opening messages as free-text churn/
// cancellation context — there's no structured "reason" field to query like
// HubSpot's closed-lost deal properties, so this reads the conversation body
// itself. Read-only: only the "Read conversations" scope is required.
export async function fetchRecentIntercomChurnNotes(accessToken: string, limit = 10): Promise<string[]> {
  const res = await fetch(`https://api.intercom.io/conversations?per_page=${limit}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Intercom-Version": "2.11",
    },
  });
  if (!res.ok) return [];

  const data = await res.json();
  type Conversation = { id: string; source?: { body?: string | null } };
  const conversations: Conversation[] = data.conversations ?? [];

  return conversations
    .map((c) => (c.source?.body ? stripHtml(c.source.body) : null))
    .filter((text): text is string => Boolean(text));
}
