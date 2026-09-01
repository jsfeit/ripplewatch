"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = ["pending", "contacted", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export function AffiliateStatusSelect({ id, initialStatus }: { id: string; initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [saving, setSaving] = useState(false);

  async function updateStatus(next: Status) {
    const prev = status;
    setStatus(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setStatus(prev);
    } catch {
      setStatus(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Select value={status} onValueChange={(v) => v && updateStatus(v as Status)} disabled={saving}>
      <SelectTrigger className="h-8 w-[110px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s[0].toUpperCase() + s.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
