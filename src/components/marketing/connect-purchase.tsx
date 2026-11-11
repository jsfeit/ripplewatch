"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectCheckoutModal, CONNECT_PROMO_KEY } from "@/components/app/connect-checkout-modal";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { readStoredUtm } from "@/components/utm-capture";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { LiveReadStep } from "@/components/marketing/live-read-step";
import { CONNECT_BASE_FEE_USD, CONNECT_DEFAULT_RELOAD_USD } from "@/lib/connect-pricing";
import { CONNECT_NAME } from "@/lib/connect";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "ripplewatch-connect-draft";

type Draft = { companyName: string };

// Every signup opens with this balance; Settings offers other amounts when
// reloading later, once someone has an actual sense of their own usage.
const OPENING_BALANCE_USD = CONNECT_DEFAULT_RELOAD_USD;

// Buying Ripplewatch Connect end to end: account, then Stripe Checkout for the
// platform fee plus the opening balance. Kept separate from the dashboard
// onboarding because it asks for far less (no competitors or positioning: the
// assistant collects those as you use it). The account is created on hold and
// only switched on by the Stripe webhook after the payment clears.
const FUNNEL_DRAFT_KEY = "rw_connect_draft";

export function ConnectPurchase({
  initiallySignedIn,
  pendingCompanyName,
  skipRead = false,
}: {
  initiallySignedIn: boolean;
  // Straight to the account form: for people sent here by an assistant's Connect button.
  skipRead?: boolean;
  // Set when a signed-in user's account carries a company name from
  // signUp() but has no Connect account yet — i.e. they're back from
  // confirming their email. Read server-side from auth user_metadata
  // rather than the sessionStorage draft below, which is empty whenever
  // the confirm link opens in a different tab/window than the one that
  // filled the form (the common case: webmail and most mail clients open
  // links in a new tab). See /onboarding/page.tsx.
  pendingCompanyName?: string | null;
}) {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  // The top of the signup funnel: how many people reach the form at all.
  useEffect(() => {
    trackEvent("connect_form_viewed");
  }, []);
  const [password, setPassword] = useState("");
  const [promo, setPromo] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "confirm-email" | "ready">("idle");
  // Resend state for the "check your email" screen. Supabase limits how often
  // a confirmation can be re-sent per address, so the button waits out a
  // cooldown instead of letting people hit that limit.
  const [resendWait, setResendWait] = useState(0);
  const [resendNote, setResendNote] = useState("");
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState<number | null>(null);
  const startedRef = useRef(false);
  // New visitors get one free read on a competitor before the account form.
  // Anyone already signed in (back from the email link or from Google) has
  // moved past it.
  const [phase, setPhase] = useState<"read" | "form">(initiallySignedIn || skipRead ? "form" : "read");

  // A visitor who gets as far as the account form and leaves comes back to it, filled in, not to
  // the start. Only the company name and email are kept (never the password), in this browser.
  // Signed-in people don't need this: their place is read off their account.
  useEffect(() => {
    if (initiallySignedIn) return;
    try {
      const saved = JSON.parse(localStorage.getItem(FUNNEL_DRAFT_KEY) ?? "null") as { companyName?: string; email?: string } | null;
      if (saved?.companyName) {
        // Reading the browser's saved draft on arrival: it can't be known during the server render.
        /* eslint-disable react-hooks/set-state-in-effect */
        setCompanyName(saved.companyName);
        if (saved.email) setEmail(saved.email);
        setPhase("form");
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // Storage blocked or unreadable: they start from the top.
    }
  }, [initiallySignedIn]);
  useEffect(() => {
    if (initiallySignedIn || phase !== "form" || !companyName.trim()) return;
    try {
      localStorage.setItem(FUNNEL_DRAFT_KEY, JSON.stringify({ companyName: companyName.trim(), email: email.trim() }));
    } catch {
      // Storage blocked: nothing is held, the flow still works.
    }
  }, [initiallySignedIn, phase, companyName, email]);

  const canSubmit =
    Boolean(companyName.trim()) &&
    (initiallySignedIn || (EMAIL_PATTERN.test(email.trim()) && password.length >= 8));

  // Creates the Connect account (idempotent) and opens payment.
  async function createAccountAndPay(fundingUsd: number, name: string) {
    const res = await fetch("/api/connect/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }
    try {
      if (promo.trim()) sessionStorage.setItem(CONNECT_PROMO_KEY, promo.trim());
      else sessionStorage.removeItem(CONNECT_PROMO_KEY);
    } catch {
      // Private mode: the code just isn't applied.
    }
    try {
      localStorage.removeItem(FUNNEL_DRAFT_KEY);
    } catch {
      // ignore
    }
    trackEvent("sign_up", { method: "email", product: "connect" });
    trackEvent("begin_checkout", { currency: "USD", value: CONNECT_BASE_FEE_USD + fundingUsd, item_name: "connect" });
    setStatus("idle");
    setCheckout(fundingUsd);
  }

  // Coming back from the email-confirmation link: signed in, no account yet,
  // and a name to confirm — from the same-tab sessionStorage draft when
  // available, else from pendingCompanyName (the cross-tab case). Show a
  // quick "welcome back" screen rather than silently firing the payment
  // request: jumping straight into a Stripe modal with no transition reads
  // as the page doing something unprompted.
  useEffect(() => {
    if (!initiallySignedIn || startedRef.current) return;
    const raw = sessionStorage.getItem(DRAFT_KEY);
    let name = pendingCompanyName?.trim() || "";
    if (raw) {
      sessionStorage.removeItem(DRAFT_KEY);
      try {
        name = (JSON.parse(raw) as Draft).companyName || name;
      } catch {
        // unreadable draft: fall through to pendingCompanyName, if any
      }
    }
    if (!name) return;
    startedRef.current = true;
    setCompanyName(name);
    setStatus("ready");
  }, [initiallySignedIn, pendingCompanyName]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "working") return;
    setStatus("working");
    setError("");

    if (!initiallySignedIn) {
      // Saved before signUp so it survives the reload an email-confirmation
      // link causes.
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ companyName: companyName.trim() } satisfies Draft));
      const { data, error: signUpError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        // See signup-form.tsx for why this is a bare origin: the confirm
        // email template builds the /auth/confirm link from
        // {{ .RedirectTo }} directly, so the real destination travels as
        // custom data instead, read back as {{ .Data.next }}.
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            next: "/onboarding?path=connect",
            company_name: companyName.trim(),
            // Kept on the user so where they came from survives even if the account is made later.
            ...(readStoredUtm() ? { utm: readStoredUtm()!.label } : {}),
          },
        },
      });
      if (signUpError) {
        sessionStorage.removeItem(DRAFT_KEY);
        setError(signUpError.message || "Something went wrong. Try again.");
        setStatus("idle");
        return;
      }
      if (!data.session) {
        // The signup itself just sent the first email, so a resend is only
        // allowed once the same cooldown has passed.
        setResendWait(60);
        setStatus("confirm-email");
        return;
      }
      sessionStorage.removeItem(DRAFT_KEY);
    }
    await createAccountAndPay(OPENING_BALANCE_USD, companyName.trim());
  }

  useEffect(() => {
    if (resendWait <= 0) return;
    const t = setTimeout(() => setResendWait((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendWait]);

  async function resendConfirmation() {
    if (resendWait > 0) return;
    setResendNote("");
    setResendWait(60);
    // The destination (/onboarding?path=connect) and company name already
    // live in the user's metadata from signUp, which the email template reads.
    const { error: resendError } = await createClient().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setResendNote(
      resendError
        ? "Couldn't resend just now. Give it a minute and try again."
        : `Sent again to ${email.trim()}. Check spam if it still doesn't show up.`
    );
  }

  if (status === "confirm-email") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="size-8 text-primary" />
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to {email}. Follow it and you&apos;ll land back here to finish paying.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void resendConfirmation()} disabled={resendWait > 0}>
          {resendWait > 0 ? `Resend email (${resendWait}s)` : "Resend email"}
        </Button>
        {resendNote ? <p className="text-xs text-muted-foreground">{resendNote}</p> : null}
      </div>
    );
  }

  if (initiallySignedIn && status === "working" && checkout === null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="font-medium">Setting up your account…</p>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="size-8 text-primary" />
        <div>
          <p className="font-medium">Email confirmed. You&apos;re in, {companyName}.</p>
          <p className="mt-1 text-sm text-muted-foreground">One payment step and {CONNECT_NAME} is live.</p>
        </div>
        <div className="w-full rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{CONNECT_NAME} platform fee</span>
            <span>${CONNECT_BASE_FEE_USD}/month</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Opening balance</span>
            <span>${OPENING_BALANCE_USD}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
            <span>Due today</span>
            <span>${CONNECT_BASE_FEE_USD + OPENING_BALANCE_USD}</span>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          className="w-full"
          onClick={() => {
            setStatus("working");
            void createAccountAndPay(OPENING_BALANCE_USD, companyName);
          }}
        >
          Continue to payment
        </Button>
      </div>
    );
  }

  if (phase === "read") {
    return (
      <LiveReadStep
        initialCompany={companyName}
        onDone={(name) => {
          if (name) setCompanyName(name);
          setPhase("form");
        }}
        onSkip={(name) => {
          if (name) setCompanyName(name);
          setPhase("form");
        }}
      />
    );
  }

  return (
    <>
      <ConnectCheckoutModal
        open={checkout !== null}
        onOpenChange={(open) => {
          if (!open) {
            // Closed without paying: the account exists (on hold) and this page is where it
            // stays, on the payment step, until they pay. Middleware sends them back here
            // from anywhere else in the app.
            setCheckout(null);
            setStatus("ready");
          }
        }}
        kind="signup"
        fundingUsd={checkout ?? CONNECT_DEFAULT_RELOAD_USD}
      />
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="space-y-2">
          <Label htmlFor="connectCompany">Company name</Label>
          <Input id="connectCompany" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme" required />
        </div>

        {!initiallySignedIn ? (
          <>
            <GoogleButton
              next="/onboarding?path=connect"
              product="connect"
              onStart={() => {
                // Same-tab draft the email flow uses, so a typed company name survives the trip to Google and back.
                if (companyName.trim()) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ companyName: companyName.trim() } satisfies Draft));
              }}
            />
            <OrDivider />
            <div className="space-y-2">
              <Label htmlFor="connectEmail">Work email</Label>
              <Input id="connectEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="connectPassword">Password</Label>
              <Input id="connectPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
          </>
        ) : null}

        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{CONNECT_NAME} platform fee</span>
            <span>${CONNECT_BASE_FEE_USD}/month</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Opening balance</span>
            <span>${OPENING_BALANCE_USD}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
            <span>Due today</span>
            <span>${CONNECT_BASE_FEE_USD + OPENING_BALANCE_USD}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Answers and competitor monitoring draw from this balance, so you only ever pay for what you use. Add more
            anytime from Settings. Tax is added at checkout. The platform fee is refundable within 30 days; balance
            already used is not.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="connectPromo">Promo code (optional)</Label>
          <Input id="connectPromo" value={promo} onChange={(e) => setPromo(e.target.value)} autoComplete="off" />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={!canSubmit || status === "working"}>
          {status === "working" ? <Loader2 className="size-4 animate-spin" /> : null}
          Continue to payment
        </Button>
      </form>
    </>
  );
}
