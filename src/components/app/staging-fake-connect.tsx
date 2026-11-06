"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Staging only (the page decides whether to render it). A stand-in for connecting a real assistant, so the
// connect step looks exactly as it does in production until you press it, then shows the connected state.
export function StagingFakeConnect() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/staging/fake-connect", { method: "POST" });
      if (!res.ok) throw new Error("Could not fake the connection.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fake the connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm">
      <span className="font-medium">Staging only</span>
      <span className="text-muted-foreground">No real assistant here. Press to pretend one just connected.</span>
      <Button type="button" size="sm" variant="outline" onClick={() => void connect()} disabled={busy}>
        {busy ? "Connecting…" : "Fake connect"}
      </Button>
      {error ? <span className="text-destructive">{error}</span> : null}
    </div>
  );
}
