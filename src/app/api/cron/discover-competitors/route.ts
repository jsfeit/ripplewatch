import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDiscoveryForAccount } from "@/lib/discover-competitors";
import { mapWithConcurrency } from "@/lib/crawl";
import type { Database } from "@/lib/supabase/types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

const ACCOUNT_CONCURRENCY = 3; // matches crawl.ts's cross-account bound — one web-search-grounded LLM call per account

// Runs weekly (see vercel.json). One web-search-grounded call per account,
// excluding names already tracked or already surfaced (pending, added, or
// previously dismissed) so a dismissed suggestion never resurfaces and an
// already-added one is never suggested again as if it were new.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("accounts").select("*").eq("status", "active");

  const summary = await mapWithConcurrency(accounts ?? [], ACCOUNT_CONCURRENCY, (account: Account) =>
    runDiscoveryForAccount(supabase, account)
  );

  return NextResponse.json({ ok: true, summary });
}
