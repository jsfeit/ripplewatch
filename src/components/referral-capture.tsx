"use client";

import { useEffect } from "react";

export const REFERRAL_STORAGE_KEY = "rw-ref";

// Mirrors utm-capture.tsx exactly: a referral link lands with ?ref=CODE on
// whatever page it points at (the /refer landing page, or any page someone
// pasted the param onto), but signup usually happens several clicks later
// with no query string left. Runs on every page load and, only when the
// URL actually carries ?ref=, persists it to localStorage so onboarding can
// still attach it whenever signup actually completes.
export function ReferralCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;
    localStorage.setItem(REFERRAL_STORAGE_KEY, ref.trim().toUpperCase());
  }, []);

  return null;
}
