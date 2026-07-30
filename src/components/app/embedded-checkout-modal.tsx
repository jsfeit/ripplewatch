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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: "starter" | "plus" | "advanced";
  period: "monthly" | "annual";
}) {
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, period }),
    });
    const data = await res.json();
    if (!res.ok || !data.clientSecret) throw new Error(data.error ?? "Could not start checkout.");
    return data.clientSecret as string;
  }, [tier, period]);

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
