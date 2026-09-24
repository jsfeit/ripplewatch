"use client";

import { useState } from "react";

export type EvalLabel = "correct" | "incorrect" | null;

// The actual stateful logic behind both thumbs-up/down controls
// (EvalLabelControl in admin, SignalRatingControl in the app) — they PATCH
// the same signal_eval_labels-backed endpoint (just under a different
// base path per surface) with the same optimistic-update/rollback
// behavior and toggle-to-clear semantics, and used to have that whole
// state machine hand-duplicated in both components. The two surfaces'
// visual treatment genuinely differs (admin is a plain icon toggle; the
// app one has its own muted/hover/pending styling meant for an end
// customer), so only the logic moved here — each component still owns its
// own render.
export function useEvalLabel(endpointBase: string, signalId: string, initialLabel: EvalLabel) {
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
        ? await fetch(`${endpointBase}/${signalId}/eval-label`, { method: "DELETE" })
        : await fetch(`${endpointBase}/${signalId}/eval-label`, {
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

  return { label, pending, setEvalLabel };
}
