"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase redirects here with either a session in the URL hash
    // (#access_token=...) or an error (#error=access_denied&error_code=
    // otp_expired&...) if the link was already used or has expired — most
    // commonly by requesting a second reset link, which invalidates the
    // first. Surfacing this explicitly avoids leaving the page stuck on a
    // "verifying" spinner forever when the link simply isn't valid anymore.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const errorDescription = hashParams.get("error_description");
    if (errorDescription) {
      // Reading an error out of the URL hash Supabase redirected here with,
      // not deriving state from props/other state — one-time sync from an
      // external source on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkError(errorDescription.replace(/\+/g, " "));
      return;
    }

    const supabase = createClient();
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      // The recovery link from /api/auth/forgot-password is generated
      // server-side (supabase.auth.admin.generateLink), so it carries the
      // session directly as implicit-flow hash tokens rather than a PKCE
      // code — there's no browser-side code_verifier for a link created
      // outside a browser session. createBrowserClient's automatic
      // detectSessionInUrl is tuned for the PKCE flow this client
      // otherwise uses and won't pick these up on its own, so the session
      // is set explicitly instead.
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
        if (error) setLinkError(error.message);
        else setReady(true);
      });
      return;
    }

    // Fallback for any other Supabase-initiated recovery redirect that
    // already resulted in a session (e.g. via detectSessionInUrl).
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/app/dashboard");
      router.refresh();
    }, 1500);
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold">Password updated</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
        </CardContent>
      </Card>
    );
  }

  if (linkError) {
    return (
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold">This link no longer works</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {linkError}. Requesting a second reset email invalidates the first, so only the most
            recent link you received will work.
          </p>
          <a
            href="/forgot-password"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Request a new link
          </a>
        </CardContent>
      </Card>
    );
  }

  if (!ready) {
    return (
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold">Set a new password</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Verifying your reset link… if this doesn&apos;t update in a few seconds, the link may have
            expired; request a new one from the{" "}
            <a href="/forgot-password" className="text-primary hover:underline">
              forgot password
            </a>{" "}
            page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold">Set a new password</h1>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
