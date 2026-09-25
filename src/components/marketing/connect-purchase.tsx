"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectCheckoutModal } from "@/components/app/connect-checkout-modal";
import { ConnectFundingPicker, fundingFromPicker } from "@/components/app/connect-funding-picker";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { CONNECT_BASE_FEE_USD, CONNECT_DEFAULT_RELOAD_USD } from "@/lib/connect-pricing";
import { CONNECT_NAME } from "@/lib/connect";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "ripplewatch-connect-draft";

type Draft = { companyName: string; fundingUsd: number };

// Buying Ripplewatch Connect end to end: account, then Stripe Checkout for the
// platform fee plus the opening balance. Kept separate from the dashboard
// onboarding because it asks for far less (no competitors or positioning: the
// assistant collects those as you use it). The account is created on hold and
// only switched on by the Stripe webhook after the payment clears.
export function ConnectPurchase({ initiallySignedIn }: { initiallySignedIn: boolean }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [picker, setPicker] = useState<number | "custom">(CONNECT_DEFAULT_RELOAD_USD);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "confirm-email">("idle");
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState<number | null>(null);
  const startedRef = useRef(false);

  const funding = fundingFromPicker(picker, custom);
  const canSubmit =
    Boolean(companyName.trim()) &&
    funding !== null &&
    (initiallySignedIn || (EMAIL_PATTERN.test(email.trim()) && password.length >= 6));

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
    trackEvent("sign_up", { method: "email", product: "connect" });
    trackEvent("begin_checkout", { currency: "USD", value: CONNECT_BASE_FEE_USD + fundingUsd, item_name: "connect" });
    setStatus("idle");
    setCheckout(fundingUsd);
  }

  // Coming back from the email-confirmation link: signed in, no account yet,
  // and a saved draft. Pick up where the form left off.
  useEffect(() => {
    if (!initiallySignedIn || startedRef.current) return;
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    startedRef.current = true;
    sessionStorage.removeItem(DRAFT_KEY);
    try {
      const draft = JSON.parse(raw) as Draft;
      // Restoring a form saved before an external redirect.
      /* eslint-disable react-hooks/set-state-in-effect */
      setCompanyName(draft.companyName);
      setStatus("working");
      /* eslint-enable react-hooks/set-state-in-effect */
      void createAccountAndPay(draft.fundingUsd, draft.companyName);
    } catch {
      // unreadable draft: the visible form still works
    }
  }, [initiallySignedIn]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || funding === null || status === "working") return;
    setStatus("working");
    setError("");

    if (!initiallySignedIn) {
      // Saved before signUp so it survives the reload an email-confirmation
      // link causes.
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ companyName: companyName.trim(), fundingUsd: funding } satisfies Draft));
      const { data, error: signUpError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/onboarding?path=connect` },
      });
      if (signUpError) {
        sessionStorage.removeItem(DRAFT_KEY);
        setError(signUpError.message || "Something went wrong. Try again.");
        setStatus("idle");
        return;
      }
      if (!data.session) {
        setStatus("confirm-email");
        return;
      }
      sessionStorage.removeItem(DRAFT_KEY);
    }
    await createAccountAndPay(funding, companyName.trim());
  }

  if (status === "confirm-email") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="size-8 text-primary" />
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to {email}. Follow it and you&apos;ll land back here to finish paying.
        </p>
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

  return (
    <>
      <ConnectCheckoutModal
        open={checkout !== null}
        onOpenChange={(open) => {
          if (!open) {
            // Closed without paying: the account exists (on hold) and Settings
            // offers to finish the purchase.
            setCheckout(null);
            router.push("/app/settings?tab=connect");
            router.refresh();
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
            <div className="space-y-2">
              <Label htmlFor="connectEmail">Work email</Label>
              <Input id="connectEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="connectPassword">Password</Label>
              <Input id="connectPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <Label>Opening usage balance</Label>
          <ConnectFundingPicker value={picker} onChange={setPicker} custom={custom} onCustomChange={setCustom} />
          <p className="text-xs text-muted-foreground">
            Answers and competitor monitoring draw from this balance, so you only ever pay for what you use.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{CONNECT_NAME} platform fee</span>
            <span>${CONNECT_BASE_FEE_USD}/month</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Opening balance</span>
            <span>{funding ? `$${funding}` : "-"}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
            <span>Due today</span>
            <span>{funding ? `$${CONNECT_BASE_FEE_USD + funding}` : "-"}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tax is added at checkout. The platform fee is refundable within 30 days; balance already used is not.</p>
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
