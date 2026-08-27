"use client";

import { useCallback } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getClientStripe } from "@/lib/stripe-client";

export function EmbeddedCheckoutModal({
  open,
  onOpenChange,
  tier,
  period,
  returnPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: "starter" | "plus" | "advanced";
  period: "monthly" | "annual";
  // Where Stripe sends the browser after payment completes. Omit to keep
  // the default (Settings) — pass "/app/dashboard" for a brand-new account
  // that has nothing to see in Settings yet.
  returnPath?: "/app/dashboard" | "/app/settings";
}) {
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, period, returnPath }),
    });
    const data = await res.json();
    if (!res.ok || !data.clientSecret) throw new Error(data.error ?? "Could not start checkout.");
    return data.clientSecret as string;
  }, [tier, period, returnPath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-xl">
        <DialogTitle className="sr-only">Checkout</DialogTitle>
        {open ? (
          <EmbeddedCheckoutProvider stripe={getClientStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
