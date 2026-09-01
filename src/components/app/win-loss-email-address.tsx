"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function WinLossEmailAddress({ accountId }: { accountId: string }) {
  const [copied, setCopied] = useState(false);
  const address = `winloss+${accountId}@in.ripplewatch.ai`;

  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3">
      <code className="flex-1 truncate text-sm">{address}</code>
      <button
        type="button"
        onClick={copy}
        className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
