import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createAdminClient } from "@/lib/supabase/admin";

export type StatusCheck = {
  name: string;
  configured: boolean;
  ok: boolean;
  detail: string;
};

async function checkSupabase(): Promise<StatusCheck> {
  if (!isSupabaseConfigured()) {
    return { name: "Supabase", configured: false, ok: false, detail: "Env vars not set." };
  }
  try {
    const { error } = await createAdminClient().from("accounts").select("id", { count: "exact", head: true });
    if (error) throw error;
    return { name: "Supabase", configured: true, ok: true, detail: "Connected." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { name: "Supabase", configured: true, ok: false, detail: message };
  }
}

async function checkStripe(): Promise<StatusCheck> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { name: "Stripe", configured: false, ok: false, detail: "STRIPE_SECRET_KEY not set." };
  }
  try {
    const { getStripe } = await import("@/lib/stripe");
    const balance = await getStripe().balance.retrieve();
    const mode = balance.livemode ? "LIVE" : "test";
    const missingPrices = [
      !process.env.STRIPE_PRICE_STARTER && "STRIPE_PRICE_STARTER",
      !process.env.STRIPE_PRICE_PLUS && "STRIPE_PRICE_PLUS",
      !process.env.STRIPE_PRICE_STARTER_ANNUAL && "STRIPE_PRICE_STARTER_ANNUAL",
      !process.env.STRIPE_PRICE_PLUS_ANNUAL && "STRIPE_PRICE_PLUS_ANNUAL",
    ].filter(Boolean);
    const webhookOk = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
    const detail =
      `Mode: ${mode}.` +
      (missingPrices.length ? ` Missing price IDs: ${missingPrices.join(", ")}.` : " All price IDs set.") +
      (webhookOk ? " Webhook secret set." : " Webhook secret missing.");
    return { name: "Stripe", configured: true, ok: missingPrices.length === 0 && webhookOk, detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { name: "Stripe", configured: true, ok: false, detail: `Key rejected: ${message}` };
  }
}

async function checkAnthropic(): Promise<StatusCheck> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { name: "Anthropic", configured: false, ok: false, detail: "ANTHROPIC_API_KEY not set." };
  }
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await client.models.list({ limit: 1 });
    return { name: "Anthropic", configured: true, ok: true, detail: "Key valid." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { name: "Anthropic", configured: true, ok: false, detail: `Key rejected: ${message}` };
  }
}

async function checkResend(): Promise<StatusCheck> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { name: "Resend", configured: false, ok: false, detail: "RESEND_API_KEY or RESEND_FROM_EMAIL not set." };
  }
  try {
    const { Resend } = await import("resend");
    const client = new Resend(process.env.RESEND_API_KEY);
    const { error } = await client.domains.list();
    if (error) throw new Error(error.message);
    return { name: "Resend", configured: true, ok: true, detail: `Sending as ${process.env.RESEND_FROM_EMAIL}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { name: "Resend", configured: true, ok: false, detail: `Key rejected: ${message}` };
  }
}

function checkSlack(): StatusCheck {
  const configured = Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
  return {
    name: "Slack",
    configured,
    ok: configured,
    detail: configured ? "Client ID/secret set." : "SLACK_CLIENT_ID/SECRET not set.",
  };
}

function checkHubspot(): StatusCheck {
  const configured = Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET);
  return {
    name: "HubSpot",
    configured,
    ok: configured,
    detail: configured ? "Client ID/secret set." : "HUBSPOT_CLIENT_ID/SECRET not set.",
  };
}

function checkCron(): StatusCheck {
  const value = process.env.CRON_SECRET;
  const isPlaceholder = value === "dev-only-placeholder-change-me";
  return {
    name: "Cron secret",
    configured: Boolean(value),
    ok: Boolean(value) && !isPlaceholder,
    detail: !value
      ? "CRON_SECRET not set."
      : isPlaceholder
        ? "Still using the dev placeholder — set a real random value before deploying."
        : "Set.",
  };
}

export async function getSystemStatus(): Promise<StatusCheck[]> {
  const [supabase, stripe, anthropic, resend] = await Promise.all([
    checkSupabase(),
    checkStripe(),
    checkAnthropic(),
    checkResend(),
  ]);
  return [supabase, stripe, anthropic, resend, checkSlack(), checkHubspot(), checkCron()];
}
