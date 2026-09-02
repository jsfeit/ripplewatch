import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier, AccountStatus } from "@/lib/supabase/types";

const VALID_TIERS = ["starter", "plus", "advanced"];
const VALID_STATUSES = ["active", "hold", "cancelled"];

// Manual override for support/sales use — all tiers are self-serve now, but
// this stays as a direct way to fix or comp an account's tier, and to pause
// (status) an account without deleting it. Every account-iterating cron
// (crawl, digests, industry-trends, discover-competitors, payment-reminders)
// skips anything not "active", so setting status stops real Anthropic spend
// and outbound email for that account immediately.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const update: { tier?: Tier; status?: AccountStatus; demo_mode?: boolean } = {};

  if (body?.tier !== undefined) {
    if (!VALID_TIERS.includes(body.tier)) {
      return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
    }
    update.tier = body.tier as Tier;
  }

  if (body?.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    update.status = body.status as AccountStatus;
  }

  if (body?.demo_mode !== undefined) {
    if (typeof body.demo_mode !== "boolean") {
      return NextResponse.json({ error: "Invalid demo_mode." }, { status: 400 });
    }
    update.demo_mode = body.demo_mode;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
