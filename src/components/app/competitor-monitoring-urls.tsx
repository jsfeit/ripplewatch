"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guessPricingUrl, guessCareersUrl } from "@/lib/domain";

type SaveState = "idle" | "saving" | "saved" | "error";

export function CompetitorMonitoringUrls({
  competitorId,
  domain,
  initialPricingUrl,
  initialCareersUrl,
}: {
  competitorId: string;
  domain: string | null;
  initialPricingUrl: string | null;
  initialCareersUrl: string | null;
}) {
  // Falls back to a guessed URL when nothing's saved yet, so the field
  // isn't blank — but that guess is only ever a suggestion sitting in the
  // input; it's not written anywhere until the user confirms it (by
  // blurring the field, even without changing it) or edits it.
  const [pricingUrl, setPricingUrl] = useState(initialPricingUrl ?? (domain ? guessPricingUrl(domain) ?? "" : ""));
  const [careersUrl, setCareersUrl] = useState(initialCareersUrl ?? (domain ? guessCareersUrl(domain) ?? "" : ""));
  const [pricingState, setPricingState] = useState<SaveState>("idle");
  const [careersState, setCareersState] = useState<SaveState>("idle");

  async function save(field: "pricing_url" | "careers_url", value: string, setState: (s: SaveState) => void) {
    setState("saving");
    try {
      const res = await fetch(`/api/competitors/${competitorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
    }
  }

  function StatusIcon({ state }: { state: SaveState }) {
    if (state === "saving") return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />;
    if (state === "saved") return <Check className="size-3.5 text-primary" />;
    if (state === "error") return <span className="text-xs text-destructive">Couldn&apos;t save</span>;
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="pricing-url" className="text-xs text-muted-foreground">
            Pricing page URL
          </Label>
          <StatusIcon state={pricingState} />
        </div>
        <Input
          id="pricing-url"
          value={pricingUrl}
          onChange={(e) => setPricingUrl(e.target.value)}
          onBlur={(e) => save("pricing_url", e.target.value.trim(), setPricingState)}
          placeholder="https://acme.com/pricing"
          className="text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="careers-url" className="text-xs text-muted-foreground">
            Careers page URL
          </Label>
          <StatusIcon state={careersState} />
        </div>
        <Input
          id="careers-url"
          value={careersUrl}
          onChange={(e) => setCareersUrl(e.target.value)}
          onBlur={(e) => save("careers_url", e.target.value.trim(), setCareersState)}
          placeholder="https://acme.com/careers"
          className="text-sm"
        />
      </div>
    </div>
  );
}
