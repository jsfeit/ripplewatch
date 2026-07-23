"use client";

import { useEffect, useState } from "react";
import { Globe, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOMAIN_PATTERN, normalizeDomain } from "@/lib/domain";

export type CompetitorInput = { name: string; domain: string };

// Keyed by domain from the parent so a domain edit remounts this and
// naturally resets logoFailed — no effect needed to reset it manually.
function CompetitorLogo({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Globe className="size-4" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party logo URL, not a local asset
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt=""
      className="size-8 shrink-0 rounded-md border border-border object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function CompetitorRow({
  value,
  onChange,
  onRemove,
  removeDisabled,
}: {
  value: CompetitorInput;
  onChange: (field: keyof CompetitorInput, val: string) => void;
  onRemove: () => void;
  removeDisabled: boolean;
}) {
  // Tagged with the domain it was fetched for, so a stale response arriving
  // after the user has moved on to another domain doesn't get rendered.
  const [description, setDescription] = useState<{ domain: string; text: string } | null>(null);

  const domain = value.domain.trim();
  const domainValid = domain.length === 0 || DOMAIN_PATTERN.test(domain);

  useEffect(() => {
    if (!domain || !DOMAIN_PATTERN.test(domain)) return;

    const timer = setTimeout(() => {
      fetch(`/api/domain-lookup?domain=${encodeURIComponent(domain)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.description) setDescription({ domain, text: data.description });
        })
        .catch(() => {});
    }, 600);

    return () => clearTimeout(timer);
  }, [domain]);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2">
          <CompetitorLogo key={domain} domain={domainValid ? domain : ""} />
          <Input
            value={value.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Competitor name"
            className="flex-1"
          />
        </div>
        <div className="flex-1">
          <Input
            value={value.domain}
            onChange={(e) => onChange("domain", normalizeDomain(e.target.value))}
            placeholder="domain.com"
            className={cn(!domainValid && "border-destructive focus-visible:ring-destructive/40")}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label="Remove competitor"
        >
          <X className="size-4" />
        </Button>
      </div>
      {!domainValid ? (
        <p className="mt-1.5 pl-10 text-xs text-destructive">
          Doesn&apos;t look like a valid domain — try something like acme.com
        </p>
      ) : description?.domain === domain ? (
        <p className="mt-1.5 pl-10 text-xs text-muted-foreground">{description.text}</p>
      ) : null}
    </div>
  );
}
