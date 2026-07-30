import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { SupabaseNotConfigured } from "@/components/admin/not-configured";
import { AccountAdminView } from "@/components/admin/account-admin-view";
import { sumLlmUsageByFunction } from "@/lib/llm-pricing";

export const dynamic = "force-dynamic";

const LLM_USAGE_LOOKBACK_DAYS = 90;

export default async function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <SupabaseNotConfigured />
      </div>
    );
  }

  const supabase = createAdminClient();

  const { data: account } = await supabase.from("accounts").select("*").eq("id", id).single();
  if (!account) notFound();

  const { data: competitors } = await supabase
    .from("competitors")
    .select("*")
    .eq("account_id", id)
    .order("created_at", { ascending: true });

  const competitorIds = (competitors ?? []).map((c) => c.id);
  const { data: signals } = competitorIds.length
    ? await supabase
        .from("signals")
        .select("*")
        .in("competitor_id", competitorIds)
        .order("occurred_on", { ascending: false })
    : { data: [] };

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LLM_USAGE_LOOKBACK_DAYS);
  const { data: usageRows } = await supabase
    .from("llm_usage")
    .select(
      "account_id, function_name, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, created_at"
    )
    .eq("account_id", id)
    .gte("created_at", since.toISOString());

  const llmUsageByFunction = Array.from(sumLlmUsageByFunction(usageRows ?? []).entries())
    .map(([functionName, totals]) => ({ functionName, ...totals }))
    .sort((a, b) => b.costUsd - a.costUsd);
  const llmUsageTotalUsd = llmUsageByFunction.reduce((sum, row) => sum + row.costUsd, 0);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <AccountAdminView
        account={account}
        competitors={competitors ?? []}
        signals={signals ?? []}
        llmUsageByFunction={llmUsageByFunction}
        llmUsageTotalUsd={llmUsageTotalUsd}
        llmUsageWindowDays={LLM_USAGE_LOOKBACK_DAYS}
      />
    </div>
  );
}
