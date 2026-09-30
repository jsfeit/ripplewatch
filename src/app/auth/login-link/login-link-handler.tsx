"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginLinkHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    // Supabase's admin.generateLink({type: "magiclink"}) produces an
    // implicit-flow link: clicking it verifies server-side on Supabase's own
    // domain, then redirects here with the session as #access_token=... in
    // the URL hash rather than a PKCE code — same reason /reset-password
    // reads the hash directly instead of relying on detectSessionInUrl,
    // which is tuned for this client's normal PKCE login flow.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const errorDescription = hashParams.get("error_description");
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const next = searchParams.get("next") ?? "/app/dashboard";

    if (errorDescription) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(errorDescription.replace(/\+/g, " "));
      return;
    }
    if (!accessToken || !refreshToken) {
      setError("This link is missing its sign-in token.");
      return;
    }

    const supabase = createClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        setError(error.message);
        return;
      }
      router.push(next);
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-6">
        <div className="max-w-md space-y-2 rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold">This link no longer works</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Signing you in…
      </div>
    </div>
  );
}
