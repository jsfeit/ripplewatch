import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDiscoveryForAccount } from "@/lib/discover-competitors";

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

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
  const { data: accounts } = await supabase.from("accounts").select("*");

  const summary = [];
  for (const account of accounts ?? []) {
    summary.push(await runDiscoveryForAccount(supabase, account));
  }

  return NextResponse.json({ ok: true, summary });
}
