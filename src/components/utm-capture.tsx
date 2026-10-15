"use client";

import { useEffect } from "react";

export const UTM_STORAGE_KEY = "rw-utm";

// Ad clicks land with ?utm_source=... on whatever page the ad points at, but
// signup (the onboarding email field) usually happens several clicks later
// with no query string left on the URL. Runs on every page load and, only
// when the URL actually carries a utm_source, overwrites localStorage with
// the full utm_* set (last-touch — which ad most recently drove this visit)
// so onboarding can still attach it days later. Plain client storage, no
// cookies or third-party requests, so it doesn't need cookie consent.
// The last-touch UTMs saved above, as one short label like "instantly / email / mcp-ab-test"
// (or null when this browser never arrived with any). Used to say where a signup came from.
export function readStoredUtm(): { source: string; medium: string; campaign: string; label: string } | null {
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { utm_source?: string; utm_medium?: string; utm_campaign?: string };
    const source = (p.utm_source ?? "").slice(0, 100);
    if (!source) return null;
    const medium = (p.utm_medium ?? "").slice(0, 100);
    const campaign = (p.utm_campaign ?? "").slice(0, 100);
    return { source, medium, campaign, label: [source, medium, campaign].filter(Boolean).join(" / ") };
  } catch {
    return null;
  }
}

export function UtmCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");
    if (!utmSource) return;
    localStorage.setItem(
      UTM_STORAGE_KEY,
      JSON.stringify({
        utm_source: utmSource,
        utm_medium: params.get("utm_medium") ?? "",
        utm_campaign: params.get("utm_campaign") ?? "",
      })
    );
  }, []);

  return null;
}
