"use client";

import { useCallback } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
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
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/connect/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, fundingUsd, promoCode: kind === "signup" ? readPromo() : undefined }),
    });
    const data = await res.json();
    if (!res.ok || !data.clientSecret) {
      // A rejected code would otherwise block every retry.
      if (res.status === 400 && kind === "signup" && readPromo()) {
        try {
          sessionStorage.removeItem(CONNECT_PROMO_KEY);
        } catch {}
      }
      throw new Error(data.error ?? "Could not start checkout.");
    }
    return data.clientSecret as string;
  }, [kind, fundingUsd]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-xl max-h-[90vh] overflow-y-auto">
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
