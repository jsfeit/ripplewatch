// Central definition of what each paid tier actually unlocks — enforced in
// code here, rather than left as promises on the pricing page. Keep this in
// sync with src/lib/tiers.ts's display copy.

import type { Tier as AccountTier } from "./supabase/types";
import type { SignalType } from "./mock-data";

export const COMPETITOR_LIMIT: Record<AccountTier, number> = {
  starter: 3,
  plus: 15,
  plus_human: 15,
};

// Signal sources are now uniform across tiers — differentiation moved to
// competitor count, scoring depth (Starter's teaser cadence), and onboarding
// type instead of gating which sources are scraped at all. Reviews aren't
// scraped yet (admin-manual only, no ToS-safe free source).
export const TIER_SIGNAL_SOURCES: Record<AccountTier, SignalType[]> = {
  starter: ["pricing", "job_posting", "news", "funding"],
  plus: ["pricing", "job_posting", "news", "funding"],
  plus_human: ["pricing", "job_posting", "news", "funding"],
};

// CRM/churn-tool read-only pull is available on every tier now — Plus+Human's
// premium is analyst-led onboarding and the monthly brief, not CRM access.
export const CRM_ALLOWED: Record<AccountTier, boolean> = {
  starter: true,
  plus: true,
  plus_human: true,
};

// Team seats: Starter cap encourages upgrading once a team grows past a
// single marketer; Plus and Plus+Human are unlimited.
export const SEAT_LIMIT: Record<AccountTier, number> = {
  starter: 3,
  plus: Infinity,
  plus_human: Infinity,
};

export function seatLimitLabel(tier: AccountTier): string {
  const limit = SEAT_LIMIT[tier];
  return limit === Infinity ? "unlimited" : String(limit);
}

// Gong/Zoom call-intelligence integrations — same gate as CRM, kept as a
// separate map so the two can diverge later without re-plumbing call sites.
export const CALL_INTEL_ALLOWED: Record<AccountTier, boolean> = {
  starter: false,
  plus: true,
  plus_human: true,
};

export function competitorLimitLabel(tier: AccountTier): string {
  const limit = COMPETITOR_LIMIT[tier];
  return limit === Infinity ? "unlimited" : String(limit);
}
