"use client";

import { useState } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guessPricingUrl, guessCareersUrl } from "@/lib/domain";

type SaveState = "idle" | "saving" | "saved" | "error";

function StatusIcon({ state }: { state: SaveState }) {
  if (state === "saving") return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />;
  if (state === "saved") return <Check className="size-3.5 text-primary" />;
  if (state === "error") return <span className="text-xs text-destructive">Couldn&apos;t save</span>;
  return null;
}

// Surfaced once a URL has failed enough crawls in a row that the backend
// (trackUrlHealth in scraping.ts) has started trying to re-discover a
// replacement on its own — the same threshold, so this only lights up once
// something has actually been attempted, not on the first transient miss.
const HEALTH_WARNING_THRESHOLD = 3;

function UrlHealthWarning({ failures, lastFailedAt }: { failures: number; lastFailedAt: string | null }) {
  if (failures < HEALTH_WARNING_THRESHOLD) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
      <TriangleAlert className="size-3.5 shrink-0" />
      Failed to load {failures} crawls in a row
      {lastFailedAt ? ` (last: ${new Date(lastFailedAt).toLocaleDateString()})` : ""} — double-check this URL is
      still correct.
    </p>
  );
}

export function CompetitorMonitoringUrls({
  competitorId,
  domain,
  initialPricingUrl,
  initialCareersUrl,
  pricingFetchFailures,
  pricingLastFailedAt,
  careersFetchFailures,
  careersLastFailedAt,
}: {
  competitorId: string;
  domain: string | null;
  initialPricingUrl: string | null;
  initialCareersUrl: string | null;
  pricingFetchFailures: number;
  pricingLastFailedAt: string | null;
  careersFetchFailures: number;
  careersLastFailedAt: string | null;
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
        <UrlHealthWarning failures={pricingFetchFailures} lastFailedAt={pricingLastFailedAt} />
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
        <UrlHealthWarning failures={careersFetchFailures} lastFailedAt={careersLastFailedAt} />
      </div>
    </div>
  );
}
