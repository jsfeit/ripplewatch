import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCrawlForAccount } from "@/lib/crawl";

export const maxDuration = 300; // Vercel Cron functions get a longer budget than normal requests

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("accounts").select("*");

  const summary = [];
  for (const account of accounts ?? []) {
    summary.push(await runCrawlForAccount(supabase, account));
  }

  return NextResponse.json({ ok: true, summary });
}
