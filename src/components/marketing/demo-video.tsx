"use client";

import { useState } from "react";
import { Play } from "lucide-react";

// Click-to-play YouTube embed. Nothing is requested from YouTube until the
// button is pressed (the poster is served from this site), so the page loads
// fast and sets no third-party cookies before someone chooses to watch.
export function DemoVideo({
  videoId,
  title,
  poster,
}: {
  videoId: string;
  title: string;
  poster: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
      {playing ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 size-full cursor-pointer"
          aria-label={`Play video: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="size-full object-cover" loading="lazy" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/15">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Play className="ml-1 size-7" aria-hidden />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
