"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type FollowupCardData = {
  id: string;
  kind: "snapshot" | "competitor";
  domain: string;
  reasonLabel: string;
  createdLabel: string;
  requesterEmail: string | null;
  accountId: string | null;
  accountName: string | null;
  competitorName: string | null;
  links: { label: string; href: string }[];
  draft: {
    pricingSummary: string;
    hiringSummary: string;
    cheapestPrice: number | null;
    pricePeriod: string | null;
    openRoles: number | null;
    sources: { title: string; url: string }[];
  } | null;
};

const MODELS = [
  { value: "unknown", label: "Not sure / not applicable" },
  { value: "subscription", label: "Public flat pricing" },
  { value: "per_seat", label: "Per seat" },
  { value: "usage_based", label: "Usage-based" },
  { value: "custom", label: "Sales-led (no public price)" },
];

export function FollowupCard({ data }: { data: FollowupCardData }) {
  const router = useRouter();
  const [billingModel, setBillingModel] = useState("unknown");
  const [cheapestPrice, setCheapestPrice] = useState("");
  const [pricePeriod, setPricePeriod] = useState("");
  const [pricingSummary, setPricingSummary] = useState("");
  const [openRoles, setOpenRoles] = useState("");
  const [hiringSummary, setHiringSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "dismiss">("");
  const [error, setError] = useState("");

  const isCustomer = data.kind === "competitor";

  function useDraft() {
    if (!data.draft) return;
    setPricingSummary(data.draft.pricingSummary);
    setHiringSummary(data.draft.hiringSummary);
    if (data.draft.cheapestPrice !== null) setCheapestPrice(String(data.draft.cheapestPrice));
    if (data.draft.pricePeriod) setPricePeriod(data.draft.pricePeriod);
    if (data.draft.openRoles !== null) setOpenRoles(String(data.draft.openRoles));
  }

  async function submit(action: "resolve" | "dismiss") {
    setBusy(action === "resolve" ? "save" : "dismiss");
    setError("");
    try {
      const res = await fetch(`/api/admin/followups/${data.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, billingModel, cheapestPrice, pricePeriod, pricingSummary, openRoles, hiringSummary, notes }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <div id={data.id} className="scroll-mt-6 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {isCustomer ? "Customer competitor" : "Snapshot visitor"}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">
            {isCustomer ? data.competitorName ?? data.domain : data.domain}
            {isCustomer ? <span className="ml-2 text-sm font-normal text-muted-foreground">{data.domain}</span> : null}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCustomer ? (
              <>
                Added by{" "}
                {data.accountId ? (
                  <a className="underline underline-offset-2" href={`/admin/accounts/${data.accountId}`}>
                    {data.accountName ?? "an account"}
                  </a>
                ) : (
                  "an account"
                )}
              </>
            ) : (
              <>Requested by {data.requesterEmail ?? "an unknown visitor"}</>
            )}
            {" · "}
            {data.createdLabel}
          </p>
          <p className="mt-1 text-sm">Why it needs a person: {data.reasonLabel}.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {data.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary"
          >
            {link.label}
            <ExternalLink className="size-3" />
          </a>
        ))}
      </div>

      {data.draft ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">Research draft (verify before using)</p>
            <Button type="button" size="sm" variant="outline" onClick={useDraft}>
              Copy into the form
            </Button>
          </div>
          {data.draft.pricingSummary ? <p className="mt-2 text-muted-foreground">Pricing: {data.draft.pricingSummary}</p> : null}
          {data.draft.hiringSummary ? <p className="mt-1 text-muted-foreground">Hiring: {data.draft.hiringSummary}</p> : null}
          {data.draft.sources.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sources:{" "}
              {data.draft.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 ? ", " : ""}
                  <a className="underline underline-offset-2" href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title || s.url}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-medium">Pricing</p>
          <div className="space-y-1.5">
            <Label htmlFor={`bm-${data.id}`}>Model</Label>
            <select
              id={`bm-${data.id}`}
              value={billingModel}
              onChange={(e) => setBillingModel(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`pr-${data.id}`}>Cheapest price</Label>
              <Input id={`pr-${data.id}`} inputMode="decimal" value={cheapestPrice} onChange={(e) => setCheapestPrice(e.target.value)} placeholder="e.g. 118" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`pp-${data.id}`}>Per</Label>
              <Input id={`pp-${data.id}`} value={pricePeriod} onChange={(e) => setPricePeriod(e.target.value)} placeholder="seat/mo" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ps-${data.id}`}>What you found</Label>
            <Textarea id={`ps-${data.id}`} rows={3} value={pricingSummary} onChange={(e) => setPricingSummary(e.target.value)} placeholder="Plain sentences, e.g. plans from $118 per license per month billed annually; enterprise is quote-only." />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Hiring</p>
          <div className="space-y-1.5">
            <Label htmlFor={`or-${data.id}`}>Open roles</Label>
            <Input id={`or-${data.id}`} inputMode="numeric" value={openRoles} onChange={(e) => setOpenRoles(e.target.value)} placeholder="e.g. 14" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`hs-${data.id}`}>What you found</Label>
            <Textarea id={`hs-${data.id}`} rows={3} value={hiringSummary} onChange={(e) => setHiringSummary(e.target.value)} placeholder="e.g. mostly engineering and sales; a new VP of Partnerships." />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor={`nt-${data.id}`}>{isCustomer ? "Internal notes (not shown to the customer)" : "Anything else to tell them (optional)"}</Label>
        <Textarea id={`nt-${data.id}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void submit("resolve")} disabled={busy !== ""}>
          {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
          {isCustomer ? "Save to their account" : `Save and email ${data.requesterEmail ?? "them"}`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void submit("dismiss")} disabled={busy !== ""}>
          {busy === "dismiss" ? <Loader2 className="size-4 animate-spin" /> : null}
          Dismiss
        </Button>
        <p className="text-xs text-muted-foreground">
          {isCustomer
            ? "Writes into their competitor's pricing and hiring, marked as checked by hand. The daily crawl keeps it until it can read the real page."
            : "Sends them a short email from you with what you found; replies come to your inbox."}
        </p>
      </div>
    </div>
  );
}
