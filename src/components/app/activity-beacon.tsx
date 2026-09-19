"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Reports each in-app page a signed-in customer opens (see /api/activity).
// Skips an immediate repeat of the same page so a re-render or refresh loop
// doesn't inflate the counts.
export function ActivityBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "view", path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
