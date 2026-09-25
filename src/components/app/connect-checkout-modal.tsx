"use client";

import { useCallback } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getClientStripe } from "@/lib/stripe-client";

// Embedded Stripe Checkout for Ripplewatch Connect: the first purchase (the
// $29/month platform fee plus the opening balance) or adding funds later.
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
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/connect/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, fundingUsd }),
    });
    const data = await res.json();
    if (!res.ok || !data.clientSecret) throw new Error(data.error ?? "Could not start checkout.");
    return data.clientSecret as string;
  }, [kind, fundingUsd]);

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
