"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Sparkles } from "lucide-react";

const STORAGE_KEY = "rw-promo-banner-dismissed";

export function PromoBanner({ bannerText }: { bannerText: string | null }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Reading a per-session dismissal, keyed to this exact banner text so a
    // changed promo reappears even if an earlier one was dismissed —
    // sessionStorage (not localStorage) is the point: it clears itself when
    // the tab/session ends, matching "reappears next visit."
    if (!bannerText) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === bannerText);
  }, [bannerText]);

  // Signed-in surfaces aren't the audience for a new-signup promo.
  if (pathname?.startsWith("/app") || pathname?.startsWith("/admin")) return null;
  if (!bannerText || dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
      <Sparkles className="size-4 shrink-0" />
      <span>{bannerText}</span>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(STORAGE_KEY, bannerText);
          setDismissed(true);
        }}
        className="shrink-0 rounded-full p-0.5 hover:bg-primary-foreground/15"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
