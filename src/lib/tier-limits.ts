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

// Signal sources are now uniform across tiers — differentiation moved to
// competitor count, scoring depth (Starter's teaser cadence), and onboarding
// type instead of gating which sources are scraped at all. Reviews aren't
// scraped yet (admin-manual only, no ToS-safe free source).
export const TIER_SIGNAL_SOURCES: Record<AccountTier, SignalType[]> = {
  starter: ["pricing", "job_posting", "news", "funding"],
  plus: ["pricing", "job_posting", "news", "funding"],
  advanced: ["pricing", "job_posting", "news", "funding"],
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

export function competitorLimitLabel(tier: AccountTier): string {
  const limit = COMPETITOR_LIMIT[tier];
  return limit === Infinity ? "unlimited" : String(limit);
}
