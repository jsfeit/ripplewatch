"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { TIERS } from "@/lib/tiers";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const period = searchParams.get("period") === "annual" ? "annual" : "monthly";
  const selectedTier = TIERS.find((t) => t.id === plan && t.selfServe);
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // An invited teammate skips onboarding entirely — accepting the invite
  // links their profile to the existing account instead of creating a new one.
  const onboardingPath = inviteToken
    ? `/invite/${inviteToken}`
    : selectedTier
      ? `/onboarding?plan=${selectedTier.id}&period=${period}`
      : "/onboarding";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${onboardingPath}` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is required, there's no session yet.
    if (!data.session) {
      setNeedsConfirmation(true);
      setLoading(false);
      return;
    }

    router.push(onboardingPath);
    router.refresh();
  }

  if (needsConfirmation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="size-8 text-primary" />
          <p className="font-medium">Check your email</p>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to {email}. Follow it to finish setting up your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold">Create your account</h1>
        {inviteToken ? (
          <p className="text-sm text-muted-foreground">You&apos;ve been invited to join a team.</p>
        ) : selectedTier ? (
          <p className="text-sm text-muted-foreground">
            You selected <span className="font-medium text-foreground">{selectedTier.name}</span>,
            billed {period === "annual" ? "annually" : "monthly"}.
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <p className="text-center text-xs text-muted-foreground">
            By signing up, you agree to our{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign up
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
