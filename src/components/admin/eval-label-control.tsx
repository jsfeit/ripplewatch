"use client";

import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEvalLabel, type EvalLabel } from "@/lib/use-eval-label";

export function EvalLabelControl({ signalId, initialLabel }: { signalId: string; initialLabel: EvalLabel }) {
  const { label, pending, setEvalLabel } = useEvalLabel("/api/admin/signals", signalId, initialLabel);

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
