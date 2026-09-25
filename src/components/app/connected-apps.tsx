"use client";

import { useEffect, useState } from "react";
import { Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/date";

type Grant = { clientId: string; name: string; grantedAt: string };

const MCP_URL = "https://www.ripplewatch.ai/api/mcp";

// AI assistants (Claude, ChatGPT, ...) the user has approved through the
// connector sign-in, with a way to cut one off. Reads and revokes go through
// Supabase Auth's OAuth grants API as the signed-in user, so it only ever
// shows and affects this user's own grants. Revoking deletes the app's
// sessions and refresh tokens; an access token it already holds keeps working
// until it expires (about an hour), which the copy says plainly.
export function ConnectedApps() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.oauth.listGrants()
      .then(({ data, error: listError }) => {
        if (cancelled) return;
        if (listError || !data) {
          setUnavailable(true);
          return;
        }
        setGrants(data.map((g) => ({ clientId: g.client.id, name: g.client.name, grantedAt: g.granted_at })));
      })
      .catch(() => !cancelled && setUnavailable(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function disconnect(clientId: string) {
    setRevoking(clientId);
    setError("");
    const { error: revokeError } = await createClient().auth.oauth.revokeGrant({ clientId });
    setRevoking(null);
    if (revokeError) {
      setError("Couldn't disconnect that app. Try again.");
      return;
    }
    setGrants((current) => (current ?? []).filter((g) => g.clientId !== clientId));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Add <code className="rounded bg-secondary px-1 py-0.5 text-xs">{MCP_URL}</code> as a custom connector in
        Claude or ChatGPT and sign in when prompted. Apps you approve show up here.
      </p>

      {unavailable ? (
        <p className="text-sm text-muted-foreground">Connected apps can&apos;t be listed right now.</p>
      ) : grants === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading
        </p>
      ) : grants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No apps connected yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {grants.map((g) => (
            <li key={g.clientId} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{g.name || "Unnamed app"}</p>
                <p className="text-xs text-muted-foreground">Connected {timeAgo(g.grantedAt)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={revoking === g.clientId}
                onClick={() => void disconnect(g.clientId)}
              >
                {revoking === g.clientId ? <Loader2 className="size-3.5 animate-spin" /> : <Unplug className="size-3.5" />}
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}

      {grants && grants.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Disconnecting stops the app from renewing its access. Access it already has can last up to an hour.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
