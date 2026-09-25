// Central definition of what each paid tier actually unlocks — enforced in
// code here, rather than left as promises on the pricing page. Keep this in
// sync with src/lib/tiers.ts's display copy.

import type { Tier as AccountTier } from "./supabase/types";
import type { SignalType } from "./mock-data";

export const COMPETITOR_LIMIT: Record<AccountTier, number> = {
  starter: 3,
  plus: 20,
  // Connect isn't capped by count: each competitor draws from the prepaid
  // wallet, so what limits it is the balance.
  connect: Infinity,
};

// Signal sources are uniform across every tier — differentiation is
// competitor count, scoring depth (Starter's teaser cadence), and
// onboarding type instead of gating which sources are scraped at all.
// Reviews aren't scraped yet (admin-manual only, no ToS-safe free source).
// SEO/traffic tracking was removed entirely (2026-09) — traffic estimates
// don't indicate whether a competitor actually threatens a deal, and the
// underlying data source was never more than a stub anyway. See git history
// for src/lib/seo-data.ts if this ever needs resurrecting behind a real
// provider account.
export const TIER_SIGNAL_SOURCES: Record<AccountTier, SignalType[]> = {
  starter: ["pricing", "job_posting", "news", "funding", "product_change"],
  plus: ["pricing", "job_posting", "news", "funding", "product_change"],
  connect: ["pricing", "job_posting", "news", "funding", "product_change"],
};

// CRM (HubSpot) read-only pull is a Plus feature — same gate shape as
// CALL_INTEL_ALLOWED below.
export const CRM_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: true,
  connect: false,
};

// Team seats: Starter cap encourages upgrading once a team grows past a
// single marketer; Plus is unlimited.
export const SEAT_LIMIT: Record<AccountTier, number> = {
  starter: 3,
  plus: Infinity,
  connect: Infinity,
};

export function seatLimitLabel(tier: AccountTier): string {
  const limit = SEAT_LIMIT[tier];
  return limit === Infinity ? "unlimited" : String(limit);
}

// Zoom call-intelligence is Plus-only (Gong isn't connectable at all
// yet — see "comingSoon" in settings-view.tsx, tier-independent).
export const CALL_INTEL_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: true,
  connect: false,
};

// Intercom (churn/cancellation reasons) is Plus-only, matching the
// pricing page's "Intercom (coming soon)" line item under Plus.
export const INTERCOM_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: true,
  connect: false,
};

// Read-only REST API (see /api/v1/*) for customers wiring Ripplewatch's
// intel into their own agents/tools — a Plus feature, not a Starter-tier
// expectation.
export const API_ACCESS_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: true,
  connect: true,
};

// Connecting an AI assistant (the MCP server and its OAuth sign-in) is
// Ripplewatch Connect's product, not part of the dashboard plans. Demo
// accounts keep it so the whole product can be shown.
export const MCP_ACCESS_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: false,
  connect: true,
};

export function canUseMcp(tier: AccountTier, demoMode: boolean): boolean {
  return demoMode || MCP_ACCESS_ALLOWED[tier];
}

// Visual diffing (checkVisualChange in scraping.ts) calls a paid screenshot
// API per competitor per week — unlike everything else in scraping.ts,
// which is free scraping, this has a real per-account cost, so it's gated
// the same shape as CRM/API access above rather than uniform across tiers.
export const VISUAL_DIFF_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: true,
  connect: false,
};

export function competitorLimitLabel(tier: AccountTier): string {
  const limit = COMPETITOR_LIMIT[tier];
  return limit === Infinity ? "unlimited" : String(limit);
}

// Demo accounts (accounts.demo_mode) get the full Plus feature set —
// including integrations that are normally gated below Plus — plus an
// uncapped competitor count beyond what even Plus allows, so a demo
// shows the whole product with nothing held back. The only thing demo
// mode actually restricts is billing (see the Stripe API routes), and a
// red banner in the app shell (DemoBanner) makes that plain rather than
// leaving it a silent, undiscoverable rule.
export function effectiveTier(tier: AccountTier, demoMode: boolean): AccountTier {
  return demoMode ? "plus" : tier;
}

export function competitorCap(tier: AccountTier, demoMode: boolean): number {
  return demoMode ? Infinity : COMPETITOR_LIMIT[tier];
}

export function competitorCapLabel(cap: number): string {
  return cap === Infinity ? "unlimited" : String(cap);
}
