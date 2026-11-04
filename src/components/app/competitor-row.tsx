"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOMAIN_PATTERN, nameFromDomain, normalizeDomain } from "@/lib/domain";

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
  domainOnly = false,
}: {
  value: CompetitorInput;
  onChange: (field: keyof CompetitorInput, val: string) => void;
  onRemove: () => void;
  removeDisabled: boolean;
  // Ask for the domain alone: the name is read from the site (or the domain) and filled in. A name
  // that was set some other way (a suggestion the person picked) is left as it is.
  domainOnly?: boolean;
}) {
  // Tagged with the domain it was fetched for, so a stale response arriving
  // after the user has moved on to another domain doesn't get rendered.
  const [lookup, setLookup] = useState<{ domain: string; text: string | null; blocked: boolean } | null>(null);

  // The name this row filled in itself, so only that is ever overwritten.
  const autoName = useRef("");
  const nameIsAuto = () => !value.name.trim() || value.name === autoName.current;
  const setAutoName = (name: string) => {
    autoName.current = name;
    onChange("name", name);
  };

  const domain = value.domain.trim();
  const domainValid = domain.length === 0 || DOMAIN_PATTERN.test(domain);

  useEffect(() => {
    if (!domain || !DOMAIN_PATTERN.test(domain)) return;

    const timer = setTimeout(() => {
      fetch(`/api/domain-lookup?domain=${encodeURIComponent(domain)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.description || data.blocked) {
            setLookup({ domain, text: data.description ?? null, blocked: Boolean(data.blocked) });
          }
          if (domainOnly && data.name && nameIsAuto()) setAutoName(data.name);
        })
        .catch(() => {});
    }, 600);

    return () => clearTimeout(timer);
    // Only the domain should re-run the lookup; the name helpers read the latest value on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2">
          <CompetitorLogo key={domain} domain={domainValid ? domain : ""} />
          {domainOnly ? null : (
            <Input
              value={value.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Competitor name"
              className="flex-1"
            />
          )}
          {domainOnly ? (
            <Input
              value={value.domain}
              onChange={(e) => {
                const next = normalizeDomain(e.target.value);
                onChange("domain", next);
                if (nameIsAuto()) setAutoName(next && DOMAIN_PATTERN.test(next) ? nameFromDomain(next) : "");
              }}
              placeholder="competitor.com"
              className={cn("flex-1", !domainValid && "border-destructive focus-visible:ring-destructive/40")}
            />
          ) : null}
        </div>
        {domainOnly ? null : (
          <div className="flex-1">
            <Input
              value={value.domain}
              onChange={(e) => onChange("domain", normalizeDomain(e.target.value))}
              placeholder="domain.com"
              className={cn(!domainValid && "border-destructive focus-visible:ring-destructive/40")}
            />
          </div>
        )}
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
          Doesn&apos;t look like a valid domain; try something like acme.com
        </p>
      ) : lookup?.domain === domain && lookup.text ? (
        <p className="mt-1.5 pl-10 text-xs text-muted-foreground">
          {domainOnly && value.name ? <span className="font-medium text-foreground">{value.name}. </span> : null}
          {lookup.text}
        </p>
      ) : lookup?.domain === domain && lookup.blocked ? (
        <p className="mt-1.5 pl-10 text-xs text-muted-foreground">
          This site blocks automated checks, so there&apos;s no preview. You can still add it: I&apos;ll follow it through
          news and press, and flag it for a closer look.
        </p>
      ) : domainOnly && value.name && domainValid && domain ? (
        <p className="mt-1.5 pl-10 text-xs font-medium text-foreground">{value.name}</p>
      ) : null}
    </div>
  );
}
