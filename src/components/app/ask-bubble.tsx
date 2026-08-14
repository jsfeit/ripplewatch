"use client";

import { useState } from "react";
import { MessageCircleQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { AskChat } from "@/app/app/ask/ask-chat";

// Desktop-only (see the "hidden lg:block" wrapper) — always-available
// floating entry point into Ask, so it doesn't require a full page
// navigation to ask a quick question mid-workflow. /app/ask still exists as
// its own page for anyone who bookmarks/deep-links it directly.
export function AskBubble({ competitorNames }: { competitorNames: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 hidden lg:block">
      {open ? (
        <Panel className="mb-3 flex h-[32rem] w-96 flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageCircleQuestion className="size-4 text-primary" />
              Ask
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <AskChat competitorNames={competitorNames} />
          </div>
        </Panel>
      ) : null}

      <Button
        size="icon"
        className="ml-auto flex size-12 rounded-full shadow-lg"
        aria-label={open ? "Close Ask" : "Open Ask"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <MessageCircleQuestion className="size-5" />}
      </Button>
    </div>
  );
}
