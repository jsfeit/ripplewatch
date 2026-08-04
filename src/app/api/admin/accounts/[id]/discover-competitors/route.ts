import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDiscoveryForAccount } from "@/lib/discover-competitors";

export const maxDuration = 60; // A single web-search call, not a full crawl

// Manual single-account trigger for testing/support — runs the same
// discovery check as the weekly cron, just scoped to one account instead of
// looping every account, so you don't have to wait for Monday to see it work.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: account, error } = await supabase.from("accounts").select("*").eq("id", id).single();

  if (error || !account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const summary = await runDiscoveryForAccount(supabase, account);
  return NextResponse.json({ ok: true, summary });
}
