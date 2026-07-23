import "server-only";

export function getGongRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gong/callback`;
}

export function isGongConfigured(): boolean {
  return Boolean(process.env.GONG_CLIENT_ID && process.env.GONG_CLIENT_SECRET);
}

type GongCredentials = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

// Gong's token endpoint authenticates the client via HTTP Basic auth rather
// than body params — different from HubSpot's OAuth exchange.
export async function exchangeGongCode(code: string): Promise<GongCredentials> {
  const basicAuth = Buffer.from(`${process.env.GONG_CLIENT_ID}:${process.env.GONG_CLIENT_SECRET}`).toString(
    "base64"
  );

  const res = await fetch("https://app.gong.io/oauth2/generate-customer-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: getGongRedirectUri(),
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Gong OAuth exchange failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export type CallTranscript = {
  callId: string;
  title: string;
  occurredOn: string;
  transcriptText: string;
};

// Pulls call transcripts from the last `sinceDays` days — one API round trip
// to list recent calls, one to fetch their transcripts in bulk. Sentences are
// joined into plain text per call; no speaker diarization needed since we
// only care about what was said, not who said it.
export async function fetchRecentGongTranscripts(
  accessToken: string,
  sinceDays = 7
): Promise<CallTranscript[]> {
  const fromDateTime = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const listRes = await fetch(
    `https://api.gong.io/v2/calls?fromDateTime=${encodeURIComponent(fromDateTime)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) return [];

  const listData = await listRes.json();
  const calls: { id: string; title: string; started: string }[] = listData.calls ?? [];
  if (calls.length === 0) return [];

  const callIds = calls.slice(0, 20).map((c) => c.id);

  const transcriptRes = await fetch("https://api.gong.io/v2/calls/transcript", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filter: { callIds } }),
  });
  if (!transcriptRes.ok) return [];

  const transcriptData = await transcriptRes.json();
  const callById = new Map(calls.map((c) => [c.id, c]));

  type TranscriptEntry = { callId: string; transcript: { sentences: { text: string }[] }[] };
  return ((transcriptData.callTranscripts ?? []) as TranscriptEntry[])
    .map((entry) => {
      const call = callById.get(entry.callId);
      if (!call) return null;
      const text = entry.transcript.flatMap((seg) => seg.sentences.map((s) => s.text)).join(" ");
      if (!text.trim()) return null;
      return { callId: entry.callId, title: call.title, occurredOn: call.started, transcriptText: text };
    })
    .filter((t): t is CallTranscript => t !== null);
}
