"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Plug, Handshake, LifeBuoy, Hash } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, avatarColor } from "@/lib/utils";

const NAME_ICON: Record<string, LucideIcon> = {
  hubspot: Handshake,
  intercom: LifeBuoy,
  slack: Hash,
};

export function MockConnectorCard({
  name,
  description,
  connected,
  onConnect,
}: {
  name: string;
  description: string;
  connected: boolean;
  onConnect: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const Icon = NAME_ICON[name.toLowerCase()] ?? Plug;

  function handleClick() {
    if (connected) return;
    setConnecting(true);
    // MOCK connection — no real OAuth/API integration in this build phase.
    setTimeout(() => {
      setConnecting(false);
      onConnect();
    }, 900);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-md", avatarColor(name))}>
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={connected ? "secondary" : "outline"}
        onClick={handleClick}
        disabled={connecting || connected}
      >
        {connecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : connected ? (
          <CheckCircle2 className="size-4 text-primary" />
        ) : null}
        {connected ? "Connected" : connecting ? "Connecting…" : "Connect"}
      </Button>
    </div>
  );
}
