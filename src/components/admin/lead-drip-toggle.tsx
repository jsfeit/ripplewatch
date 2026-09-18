"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LeadDripToggle({ id, initialPaused }: { id: string; initialPaused: boolean }) {
  const [paused, setPaused] = useState(initialPaused);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !paused;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dripPaused: next }),
      });
      if (res.ok) setPaused(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={paused ? "secondary" : "outline"}
      className="h-7 px-2 text-xs"
      onClick={toggle}
      disabled={saving}
    >
      {paused ? "Paused, resume" : "Pause drip"}
    </Button>
  );
}
