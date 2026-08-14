"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner({ accountName, adminEmail }: { accountName: string; adminEmail: string }) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);

  async function endSession() {
    setEnding(true);
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    router.push("/admin/accounts");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <Eye className="size-4 shrink-0" />
      <span>
        Viewing <span className="font-semibold">{accountName}</span> as {adminEmail} (read-only)
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 border-amber-950/30 bg-transparent px-2 text-xs text-amber-950 hover:bg-amber-950/10"
        onClick={endSession}
        disabled={ending}
      >
        <X className="size-3" />
        {ending ? "Ending…" : "Exit"}
      </Button>
    </div>
  );
}
