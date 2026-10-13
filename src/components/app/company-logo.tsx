"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// A company's favicon, with its first letter standing in when there isn't one.
// Loaded from Google's favicon service, which means the domain being shown is
// sent to Google; the privacy-friendly alternative is the letter alone.
export function CompanyLogo({ name, domain, className }: { name: string; domain?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const clean = domain?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  if (!clean || failed) {
    return (
      <span
        aria-hidden="true"
        className={cn("flex size-5 shrink-0 items-center justify-center rounded bg-secondary text-[10px] font-semibold text-muted-foreground", className)}
      >
        {letter}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=64`}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      // Covers an image that finished loading before React attached onLoad (cached, or server-rendered).
      ref={(el) => {
        if (el && el.complete && el.naturalWidth > 0 && el.naturalWidth <= 16) setFailed(true);
      }}
      onError={() => setFailed(true)}
      // Google answers an unknown domain with a generic 16px globe; the letter is better than that.
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth <= 16) setFailed(true);
      }}
      // A light tile behind it, since many logos are dark marks that vanish on the dark theme.
      className={cn("size-5 shrink-0 rounded bg-white p-px", className)}
    />
  );
}
