import { notFound, redirect } from "next/navigation";
import { Globe, Waves } from "lucide-react";
import { cn, avatarColor } from "@/lib/utils";
import { AlertCard } from "@/components/app/alert-card";
import { EmptyState } from "@/components/app/empty-state";
import { CompetitorManager } from "@/components/app/competitor-manager";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .single();
  if (!profile?.account_id) redirect("/onboarding");

  const { data: account } = await supabase
    .from("accounts")
    .select("tier")
    .eq("id", profile.account_id)
    .single();
  if (!account) redirect("/onboarding");

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", profile.account_id)
    .order("created_at", { ascending: true });

  const competitor = (competitors ?? []).find((c) => c.id === id);
  if (!competitor) notFound();

  const { data: signals } = await supabase
    .from("signals")
    .select("*")
    .eq("competitor_id", id)
    .order("occurred_on", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-10 py-10">
      <CompetitorManager competitors={competitors ?? []} tier={account.tier} activeId={id} />

      <div className="mt-6 flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-full text-sm font-semibold",
            avatarColor(competitor.name)
          )}
        >
          {competitor.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{competitor.name}</h1>
          {competitor.domain ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Globe className="size-3.5" />
              {competitor.domain}
            </p>
          ) : null}
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted-foreground">Signal timeline</h2>
      {(signals ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Waves}
            title="No signals recorded yet"
            description="Crawling runs on a schedule, so check back soon."
          />
        </div>
      ) : (
        <div className="relative mt-4 space-y-6 border-l border-border pl-6">
          {(signals ?? []).map((signal) => (
            <div key={signal.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[29px] top-1.5 size-2.5 rounded-full border-2 border-background",
                  signal.scored ? "bg-primary" : "bg-muted-foreground/40"
                )}
              />
              <p className="mb-2 text-xs text-muted-foreground">{signal.occurred_on}</p>
              <AlertCard
                signal={{
                  type: signal.type,
                  title: signal.title,
                  summary: signal.summary,
                  scored: signal.scored,
                  relevanceLevel: signal.relevance_level,
                  relevanceReasoning: signal.relevance_reasoning,
                }}
                competitorName={competitor.name}
                competitorInitial={competitor.name.charAt(0).toUpperCase()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
