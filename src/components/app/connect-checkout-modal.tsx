"use client";

import { useCallback, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getClientStripe } from "@/lib/stripe-client";

// Embedded Stripe Checkout for Ripplewatch Connect: the first purchase (the
// $29/month platform fee plus the opening balance) or adding funds later.
// A promo code typed on the signup form is kept in sessionStorage so it also
// survives finishing the purchase later from Settings.
export const CONNECT_PROMO_KEY = "rw_connect_promo";

function readPromo(): string | undefined {
  try {
    return sessionStorage.getItem(CONNECT_PROMO_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function ConnectCheckoutModal({
  open,
  onOpenChange,
  kind,
  fundingUsd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "signup" | "topup";
  fundingUsd: number;
}) {
  // When our own checkout endpoint refuses (an invalid promo code, a demo
  // account, an existing subscription), Stripe's embedded form can only show
  // its generic "Something went wrong". We keep the real message and show it
  // ourselves instead.
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/connect/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, fundingUsd, promoCode: kind === "signup" ? readPromo() : undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.clientSecret) {
      // A rejected code would otherwise block every retry.
      if (res.status === 400 && kind === "signup" && readPromo()) {
        try {
          sessionStorage.removeItem(CONNECT_PROMO_KEY);
        } catch {}
      }
      setError(data.error ?? "Could not start checkout.");
      // Never resolves: the error panel replaces the checkout form right away,
      // so Stripe's generic error screen never gets a chance to show.
      return new Promise<string>(() => {});
    }
    return data.clientSecret as string;
  }, [kind, fundingUsd]);

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Checkout</DialogTitle>
        {open && error ? (
          <div role="alert" className="space-y-4 py-6 text-center">
            <p className="text-base font-semibold">We couldn&apos;t open checkout</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => setError(null)}>Try again</Button>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : open ? (
          <EmbeddedCheckoutProvider stripe={getClientStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
