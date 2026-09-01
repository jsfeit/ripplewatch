import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractWinLossEntries } from "@/lib/anthropic";
import { applyExtractedWinLossEntries } from "@/lib/win-loss-import";
import { API_ACCESS_ALLOWED } from "@/lib/tier-limits";

// Each account gets a personal inbox address, winloss+<accountId>@in.ripplewatch.ai
// — forwarding a deal-closed email there (or CC'ing it, or a CRM automation
// sending to it) needs no login, no CSV export, nothing to remember beyond
// one email address. The +accountId token is how a single shared inbox
// address routes to the right account with no signup step of its own.
const RECIPIENT_PATTERN = /^winloss\+([0-9a-f-]{36})@in\.ripplewatch\.ai$/i;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const payload = await request.text();

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers." }, { status: 401 });
  }

  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: process.env.RESEND_INBOUND_WEBHOOK_SECRET!,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // Only listening for the one event this webhook was created for — other
  // event types are ignored rather than erroring, in case the webhook's
  // subscription ever broadens.
  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const recipient = event.data.to.find((addr) => RECIPIENT_PATTERN.test(addr));
  const accountId = recipient?.match(RECIPIENT_PATTERN)?.[1];
  if (!accountId) {
    return NextResponse.json({ ok: true, ignored: "no matching account address" });
  }

  const supabase = createAdminClient();
  // Same tier gate as the API-key path (/api/v1/win-loss) — this hits the
  // same extraction LLM call, so a Starter account emailing this address
  // shouldn't quietly rack up Anthropic spend a paid API-access feature is
  // meant to be gated behind.
  const { data: account } = await supabase.from("accounts").select("tier").eq("id", accountId).single();
  if (!account || !API_ACCESS_ALLOWED[account.tier]) {
    return NextResponse.json({ ok: true, ignored: "account not on a plan with API access" });
  }

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("account_id", accountId);
  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ ok: true, ignored: "no tracked competitors" });
  }

  // The webhook payload is metadata only (no body) — fetch the full message
  // separately, same as any other Resend Receiving API consumer.
  const { data: email, error } = await resend.emails.receiving.get(event.data.email_id);
  if (error || !email) {
    console.error("resend inbound webhook: failed to fetch received email", error);
    return NextResponse.json({ error: "Could not fetch email body." }, { status: 502 });
  }

  const bodyText = email.text?.trim() || (email.html ? stripHtml(email.html) : "");
  if (!bodyText) {
    return NextResponse.json({ ok: true, ignored: "empty body" });
  }

  const competitorNames = competitors.map((c) => c.name);
  const extracted = await extractWinLossEntries(competitorNames, bodyText, accountId).catch((err) => {
    console.error("resend inbound webhook: extraction failed", err);
    return [];
  });
  if (extracted.length === 0) {
    return NextResponse.json({ ok: true, imported: 0 });
  }

  const result = await applyExtractedWinLossEntries(supabase, accountId, null, competitors, extracted);
  return NextResponse.json({ ok: true, ...result });
}
