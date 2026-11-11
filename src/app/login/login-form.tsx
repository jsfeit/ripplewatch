"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";

// People who land here from an assistant's Connect button (ChatGPT, Claude) arrive with the pending
// approval as `next`. They usually don't have an account yet, so this page says what's happening
// and sends new people to the purchase flow instead of a bare login form.
const ASSISTANT_CONNECT_PATH = "/oauth/consent";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAssistant = (searchParams.get("next") ?? "").startsWith(ASSISTANT_CONNECT_PATH);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Where /auth/callback sends people back when Google sign-in doesn't complete.
  const urlError = searchParams.get("error");
  const [error, setError] = useState(
    urlError === "google-cancelled"
      ? "Google sign-in was cancelled."
      : urlError === "google-failed"
        ? "Google sign-in didn't work. Try again, or use your email."
        : ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Sign-in count for Admin -> Users; awaited (briefly) so the navigation
    // below can't cancel it, and never blocks the login if it fails.
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "login" }),
    }).catch(() => {});

    router.push(searchParams.get("next") ?? "/app/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold">{fromAssistant ? "Connect Ripplewatch" : "Log in"}</h1>
        {fromAssistant ? (
          <p className="text-sm text-muted-foreground">
            Log in to approve the connection from your AI assistant. New here? Ripplewatch is {"$"}29 a month plus
            usage you prepay for, and setup takes a couple of minutes.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {fromAssistant ? (
          <>
            <Link href="/onboarding?src=assistant" className="block">
              <Button type="button" className="w-full">Create a Ripplewatch account</Button>
            </Link>
            <OrDivider />
          </>
        ) : null}
        <GoogleButton next={searchParams.get("next") ?? "/app/dashboard"} />
        <OrDivider />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Log in
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href={fromAssistant ? "/onboarding?src=assistant" : "/signup"} className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
