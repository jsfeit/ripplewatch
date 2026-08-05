"use client";

import { useState } from "react";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EvalLabel = "correct" | "incorrect" | null;

// Feeds the same signal_eval_labels table the admin accuracy view reads —
// real customer judgment on whether a signal actually mattered is exactly
// the ground truth the scoring rubric should be tuned against. Toggleable:
// clicking the active choice again clears it, clicking the other switches.
export function SignalRatingControl({ signalId, initialLabel }: { signalId: string; initialLabel: EvalLabel }) {
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
        ? await fetch(`/api/signals/${signalId}/eval-label`, { method: "DELETE" })
        : await fetch(`/api/signals/${signalId}/eval-label`, {
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
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="This was relevant"
        aria-pressed={label === "correct"}
        disabled={pending}
        onClick={() => setEvalLabel("correct")}
        className={cn(
          "text-muted-foreground/60 hover:text-foreground",
          label === "correct" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        )}
      >
        {pending && label !== "incorrect" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ThumbsUp className="size-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="This wasn't relevant"
        aria-pressed={label === "incorrect"}
        disabled={pending}
        onClick={() => setEvalLabel("incorrect")}
        className={cn(
          "text-muted-foreground/60 hover:text-foreground",
          label === "incorrect" &&
            "bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground"
        )}
      >
        {pending && label !== "correct" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ThumbsDown className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
