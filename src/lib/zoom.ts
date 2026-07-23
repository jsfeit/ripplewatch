import "server-only";

export function getZoomRedirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zoom/callback`;
}

export function isZoomConfigured(): boolean {
  return Boolean(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

type ZoomCredentials = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

// Zoom's token endpoint also authenticates via HTTP Basic auth, same shape
// as Gong's — both differ from HubSpot's body-param client auth.
export async function exchangeZoomCode(code: string): Promise<ZoomCredentials> {
  const basicAuth = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString(
    "base64"
  );

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: getZoomRedirectUri(),
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Zoom OAuth exchange failed: ${res.status}`);
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

// Strips WebVTT cue timing/index lines, leaving just the spoken text.
function vttToPlainText(vtt: string): string {
  return vtt
    .split("\n")
    .filter((line) => line && line !== "WEBVTT" && !/^\d+$/.test(line) && !line.includes("-->"))
    .join(" ")
    .trim();
}

// Pulls cloud-recording transcripts (Zoom's auto-generated .vtt files) from
// the last `sinceDays` days of the connected user's meetings. Only meetings
// with a TRANSCRIPT recording file are included — most orgs need the
// transcription feature enabled for that file to exist.
export async function fetchRecentZoomTranscripts(
  accessToken: string,
  sinceDays = 7
): Promise<CallTranscript[]> {
  const from = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const res = await fetch(
    `https://api.zoom.us/v2/users/me/recordings?from=${from}&to=${to}&page_size=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];

  const data = await res.json();
  type RecordingFile = { file_type: string; download_url: string };
  type Meeting = { uuid: string; topic: string; start_time: string; recording_files?: RecordingFile[] };
  const meetings: Meeting[] = data.meetings ?? [];

  const transcripts: CallTranscript[] = [];
  for (const meeting of meetings) {
    const transcriptFile = meeting.recording_files?.find((f) => f.file_type === "TRANSCRIPT");
    if (!transcriptFile) continue;

    const fileRes = await fetch(`${transcriptFile.download_url}?access_token=${accessToken}`);
    if (!fileRes.ok) continue;

    const text = vttToPlainText(await fileRes.text());
    if (!text) continue;

    transcripts.push({ callId: meeting.uuid, title: meeting.topic, occurredOn: meeting.start_time, transcriptText: text });
  }
  return transcripts;
}
