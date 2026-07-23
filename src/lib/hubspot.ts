import "server-only";

export function getHubspotRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/hubspot/callback`;
}

export function isHubspotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET);
}

type HubspotCredentials = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export async function exchangeHubspotCode(code: string): Promise<HubspotCredentials> {
  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      redirect_uri: getHubspotRedirectUri(),
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`HubSpot OAuth exchange failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

// Pulls recent closed-lost deals' close reasons — the read-only "lost deal
// context" the product spec asks for. Kept intentionally simple: one page,
// most-recently-closed first, text fields only (no pipeline/stage modeling).
export async function fetchClosedLostDealNotes(accessToken: string): Promise<string[]> {
  const res = await fetch(
    "https://api.hubapi.com/crm/v3/objects/deals/search",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          { filters: [{ propertyName: "dealstage", operator: "EQ", value: "closedlost" }] },
        ],
        sorts: [{ propertyName: "closedate", direction: "DESCENDING" }],
        properties: ["dealname", "closed_lost_reason", "notes_last_updated"],
        limit: 10,
      }),
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.results ?? [])
    .map((deal: { properties?: Record<string, string | null> }) => {
      const name = deal.properties?.dealname;
      const reason = deal.properties?.closed_lost_reason;
      return reason ? `Lost "${name}" — ${reason}` : null;
    })
    .filter((line: string | null): line is string => Boolean(line));
}
