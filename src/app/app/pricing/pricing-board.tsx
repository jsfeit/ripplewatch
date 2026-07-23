"use client";

import { useMemo, useState } from "react";
import { DollarSign } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { cn, avatarColor } from "@/lib/utils";
import { BILLING_MODEL_LABELS, BILLING_MODEL_STYLES, BILLING_MODEL_DOT } from "@/lib/billing-model";
import type { BillingModel, Database } from "@/lib/supabase/types";

type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
type CompetitorPricing = Database["public"]["Tables"]["competitor_pricing"]["Row"];
type Signal = Database["public"]["Tables"]["signals"]["Row"];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function PricingBoard({
  competitors,
  pricing,
  pricingSignals,
}: {
  competitors: Competitor[];
  pricing: CompetitorPricing[];
  pricingSignals: Signal[];
}) {
  const [modelFilter, setModelFilter] = useState<BillingModel | "all">("all");

  const pricingByCompetitor = useMemo(
    () => new Map(pricing.map((p) => [p.competitor_id, p])),
    [pricing]
  );
  const latestSignalByCompetitor = useMemo(() => {
    const map = new Map<string, Signal>();
    for (const signal of pricingSignals) {
      if (!map.has(signal.competitor_id)) map.set(signal.competitor_id, signal);
    }
    return map;
  }, [pricingSignals]);

  const modelCounts = useMemo(() => {
    const counts = new Map<BillingModel, number>();
    for (const p of pricing) counts.set(p.billing_model, (counts.get(p.billing_model) ?? 0) + 1);
    return counts;
  }, [pricing]);

  const presentModels = (Object.keys(BILLING_MODEL_LABELS) as BillingModel[]).filter(
    (m) => (modelCounts.get(m) ?? 0) > 0
  );

  // Same grouping the filter chips use — one section per billing model, plus
  // a trailing section for competitors with no pricing record yet. Within
  // each section, cheapest entry-tier price leads (left to right, top to
  // bottom); no public price sorts to the end of its group.
  const groups = useMemo(() => {
    const notYetChecked: Competitor[] = [];
    const byModel = new Map<BillingModel, Competitor[]>();

    for (const competitor of competitors) {
      const record = pricingByCompetitor.get(competitor.id);
      if (!record) {
        notYetChecked.push(competitor);
        continue;
      }
      const list = byModel.get(record.billing_model) ?? [];
      list.push(competitor);
      byModel.set(record.billing_model, list);
    }

    const sortByCheapest = (list: Competitor[]) =>
      [...list].sort((a, b) => {
        const priceA = cheapestPrice(pricingByCompetitor.get(a.id));
        const priceB = cheapestPrice(pricingByCompetitor.get(b.id));
        if (priceA === null && priceB === null) return a.name.localeCompare(b.name);
        if (priceA === null) return 1;
        if (priceB === null) return -1;
        return priceA - priceB;
      });

    const modelSections = (Object.keys(BILLING_MODEL_LABELS) as BillingModel[])
      .map((model) => ({ model, competitors: sortByCheapest(byModel.get(model) ?? []) }))
      .filter((section) => section.competitors.length > 0);

    return { modelSections, notYetChecked: notYetChecked.sort((a, b) => a.name.localeCompare(b.name)) };
  }, [competitors, pricingByCompetitor]);

  const visibleModelSections =
    modelFilter === "all" ? groups.modelSections : groups.modelSections.filter((s) => s.model === modelFilter);
  const showNotYetChecked = modelFilter === "all" && groups.notYetChecked.length > 0;
  const isEmpty = visibleModelSections.length === 0 && !showNotYetChecked;

  return (
    <div>
      {pricing.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={modelFilter === "all"}
            onClick={() => setModelFilter("all")}
            label="All models"
            count={pricing.length}
          />
          {presentModels.map((model) => (
            <FilterChip
              key={model}
              active={modelFilter === model}
              onClick={() => setModelFilter(model)}
              label={BILLING_MODEL_LABELS[model]}
              count={modelCounts.get(model) ?? 0}
              dotColor={BILLING_MODEL_DOT[model]}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-8">
        {visibleModelSections.map((section) => (
          <div key={section.model}>
            <div className="mb-3 flex items-center gap-2">
              <span className={cn("size-2 rounded-full", BILLING_MODEL_DOT[section.model])} />
              <h2 className="text-sm font-semibold">{BILLING_MODEL_LABELS[section.model]}</h2>
              <span className="text-xs text-muted-foreground">
                {section.competitors.length} · cheapest to most expensive
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {section.competitors.map((competitor) => (
                <PricingCard
                  key={competitor.id}
                  competitor={competitor}
                  record={pricingByCompetitor.get(competitor.id)}
                  changedAt={latestSignalByCompetitor.get(competitor.id)?.created_at}
                />
              ))}
            </div>
          </div>
        ))}

        {showNotYetChecked ? (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full bg-muted-foreground/40" />
              <h2 className="text-sm font-semibold">Not yet checked</h2>
              <span className="text-xs text-muted-foreground">{groups.notYetChecked.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.notYetChecked.map((competitor) => (
                <PricingCard key={competitor.id} competitor={competitor} record={undefined} changedAt={undefined} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {competitors.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No competitors yet"
          description="Add some in Competitors to start tracking their pricing."
        />
      ) : isEmpty ? (
        <EmptyState
          icon={DollarSign}
          title="No competitors match this filter"
          description="Try a different billing model, or view all."
        />
      ) : null}
    </div>
  );
}

function cheapestPrice(record: CompetitorPricing | undefined): number | null {
  if (!record || record.tiers.length === 0) return null;
  const prices = record.tiers.map((t) => t.price).filter((p): p is number => p !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function PricingCard({
  competitor,
  record,
  changedAt,
}: {
  competitor: Competitor;
  record: CompetitorPricing | undefined;
  changedAt: string | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            avatarColor(competitor.name)
          )}
        >
          {competitor.name.charAt(0).toUpperCase()}
        </span>
        <p className="flex-1 truncate text-sm font-semibold">{competitor.name}</p>
        {changedAt ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Changed {timeAgo(changedAt)}
          </span>
        ) : null}
      </div>

      {!record && !competitor.pricing_url ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No pricing page URL set for this competitor yet.
        </p>
      ) : !record ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Not checked yet — runs on the next scheduled crawl.
        </p>
      ) : (
        <>
          <span
            className={cn(
              "mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold",
              BILLING_MODEL_STYLES[record.billing_model]
            )}
          >
            <span className={cn("size-1.5 rounded-full", BILLING_MODEL_DOT[record.billing_model])} />
            {BILLING_MODEL_LABELS[record.billing_model]}
          </span>

          {!record.publicly_priced || record.tiers.length === 0 ? (
            <p className="mt-3 text-xs italic text-muted-foreground">
              {record.note ?? "No public pricing found."}
            </p>
          ) : (
            <div className="mt-1">
              {record.tiers.map((tier, i) => (
                <div key={tier.name + i} className={cn("py-2.5", i > 0 && "border-t border-border")}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {tier.name}
                  </p>
                  <p className="mt-0.5 text-base font-bold">
                    {tier.price !== null ? (
                      <>
                        ${tier.price}
                        {tier.price_period ? (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            /{tier.price_period}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-sm font-medium italic text-muted-foreground">Not public</span>
                    )}
                  </p>
                  {tier.features.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {tier.features.map((f, fi) => (
                        <li key={fi} className="before:mr-1 before:text-primary before:content-['‣']">
                          {f}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <p className="mt-2.5 border-t border-dashed border-border pt-2.5 text-[10.5px] text-muted-foreground">
            Last checked {timeAgo(record.last_checked_at)}
          </p>
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dotColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dotColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {dotColor ? <span className={cn("size-1.5 rounded-full", dotColor)} /> : null}
      {label}
      <span className={cn("text-xs", active ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
        {count}
      </span>
    </button>
  );
}
