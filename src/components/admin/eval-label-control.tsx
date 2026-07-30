"use client";

import { useState } from "react";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EvalLabel = "correct" | "incorrect" | null;

export function EvalLabelControl({ signalId, initialLabel }: { signalId: string; initialLabel: EvalLabel }) {
  const [label, setLabel] = useState<EvalLabel>(initialLabel);
  const [pending, setPending] = useState(false);

  async function setEvalLabel(next: "correct" | "incorrect") {
    if (pending) return;
    const clearing = label === next;
    setPending(true);
    const previous = label;
    setLabel(clearing ? null : next);

    try {
      const res = clearing
        ? await fetch(`/api/admin/signals/${signalId}/eval-label`, { method: "DELETE" })
        : await fetch(`/api/admin/signals/${signalId}/eval-label`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: next }),
          });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      setLabel(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Mark scoring correct"
        aria-pressed={label === "correct"}
        disabled={pending}
        onClick={() => setEvalLabel("correct")}
        className={cn(label === "correct" && "bg-primary/10 text-primary")}
      >
        {pending ? <Loader2 className="animate-spin" /> : <ThumbsUp />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Mark scoring incorrect"
        aria-pressed={label === "incorrect"}
        disabled={pending}
        onClick={() => setEvalLabel("incorrect")}
        className={cn(label === "incorrect" && "bg-destructive/10 text-destructive")}
      >
        {pending ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
      </Button>
    </div>
  );
}
