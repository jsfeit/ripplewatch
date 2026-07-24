"use client";

import { useState } from "react";
import { Copy, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type PromoCode = {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  durationInMonths: number | null;
  duration: string;
  timesRedeemed: number;
  maxRedemptions: number | null;
  created: number;
};

export function PromoCodesView({ initialCodes }: { initialCodes: PromoCode[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [customCode, setCustomCode] = useState("");
  const [percentOff, setPercentOff] = useState("20");
  const [months, setMonths] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setCreating(true);
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: customCode.trim() || undefined,
        percentOff: Number(percentOff),
        months: Number(months),
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create promo code.");
      return;
    }
    setCodes((prev) => [data.code, ...prev]);
    setCustomCode("");
    setMaxRedemptions("");
  }

  async function handleToggle(id: string, active: boolean) {
    setTogglingId(id);
    setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
    const res = await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setTogglingId(null);
    if (!res.ok) {
      setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, active: !active } : c)));
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <h2 className="font-medium">Create a code</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Code (optional)
              </label>
              <Input
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Discount %</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Months it applies
              </label>
              <Input
                type="number"
                min={1}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Max redemptions (optional)
              </label>
              <Input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create code
          </Button>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Redeemed</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-medium">
                  <button
                    type="button"
                    onClick={() => handleCopy(c.code)}
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                    aria-label={`Copy ${c.code}`}
                  >
                    {c.code}
                    <Copy className="size-3 text-muted-foreground" />
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.percentOff}% off for {c.durationInMonths} month{c.durationInMonths === 1 ? "" : "s"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.timesRedeemed}
                  {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.active}
                      onCheckedChange={(checked) => handleToggle(c.id, checked)}
                      disabled={togglingId === c.id}
                    />
                    {!c.active ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {codes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No promo codes yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
