// Central definition of what each paid tier actually unlocks — enforced in
// code here, rather than left as promises on the pricing page. Keep this in
// sync with src/lib/tiers.ts's display copy.

import type { Tier as AccountTier } from "./supabase/types";
import type { SignalType } from "./mock-data";

export const COMPETITOR_LIMIT: Record<AccountTier, number> = {
  starter: 3,
  plus: 7,
  advanced: 20,
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
  advanced: ["pricing", "job_posting", "news", "funding", "product_change"],
};

// CRM (HubSpot) read-only pull is a Plus-and-above feature — same gate
// shape as CALL_INTEL_ALLOWED below.
export const CRM_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: true,
  advanced: true,
};

// Team seats: Starter cap encourages upgrading once a team grows past a
// single marketer; Plus caps at 10; Advanced is unlimited.
export const SEAT_LIMIT: Record<AccountTier, number> = {
  starter: 3,
  plus: 10,
  advanced: Infinity,
};

export function seatLimitLabel(tier: AccountTier): string {
  const limit = SEAT_LIMIT[tier];
  return limit === Infinity ? "unlimited" : String(limit);
}

// Zoom call-intelligence is Advanced-only (Gong isn't connectable at all
// yet — see "comingSoon" in settings-view.tsx, tier-independent).
export const CALL_INTEL_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: false,
  advanced: true,
};

// Intercom (churn/cancellation reasons) is Advanced-only, matching the
// pricing page's "Intercom (coming soon)" line item under Advanced.
export const INTERCOM_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: false,
  advanced: true,
};

// Read-only REST API (see /api/v1/*) for customers wiring Ripplewatch's
// intel into their own agents/tools — a Plus/Advanced feature, same shape
// as the SEO/traffic gate above, not a Starter-tier expectation.
export const API_ACCESS_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: true,
  advanced: true,
};

export function competitorLimitLabel(tier: AccountTier): string {
  const limit = COMPETITOR_LIMIT[tier];
  return limit === Infinity ? "unlimited" : String(limit);
}

// White-label demo accounts (accounts.demo_mode) get the full Advanced
// feature set — including integrations that are normally gated below
// Advanced — plus an uncapped competitor count beyond what even Advanced
// allows, so a demo can show a long, real list of tracked and suggested
// competitors without hitting an upgrade prompt.
export function effectiveTier(tier: AccountTier, demoMode: boolean): AccountTier {
  return demoMode ? "advanced" : tier;
}

export function competitorCap(tier: AccountTier, demoMode: boolean): number {
  return demoMode ? Infinity : COMPETITOR_LIMIT[tier];
}

export function competitorCapLabel(cap: number): string {
  return cap === Infinity ? "unlimited" : String(cap);
}
