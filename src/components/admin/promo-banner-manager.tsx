"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Campaign = {
  active: boolean;
  percentOff: number;
  durationMonths: number;
  code: string;
  bannerText: string;
};

const DEFAULTS: Campaign = {
  active: false,
  percentOff: 50,
  durationMonths: 6,
  code: "NEW50",
  bannerText: "",
};

function defaultBannerText(percentOff: number, durationMonths: number, code: string): string {
  return `${percentOff}% off for the first ${durationMonths} months for initial signups using promo code ${code}!`;
}

export function PromoBannerManager({ initial }: { initial: Campaign | null }) {
  const [form, setForm] = useState<Campaign>(initial ?? DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function resetBannerText() {
    setForm((f) => ({ ...f, bannerText: defaultBannerText(f.percentOff, f.durationMonths, f.code) }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/admin/promo-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">{form.active ? "Live" : "Off"}</p>
            <p className="text-xs text-muted-foreground">
              {form.active
                ? "Applying automatically at checkout and showing the banner site-wide."
                : "No discount applied, no banner shown."}
            </p>
          </div>
          <Switch checked={form.active} onCheckedChange={(active) => setForm((f) => ({ ...f, active }))} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="promo-percent">Percent off</Label>
            <Input
              id="promo-percent"
              type="number"
              min={1}
              max={100}
              value={form.percentOff}
              onChange={(e) => setForm((f) => ({ ...f, percentOff: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-months">Duration (months)</Label>
            <Input
              id="promo-months"
              type="number"
              min={1}
              value={form.durationMonths}
              onChange={(e) => setForm((f) => ({ ...f, durationMonths: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-code">Code label</Label>
            <Input
              id="promo-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Changing percent off or duration creates a new Stripe coupon (coupons can&apos;t be edited once
          created) — the code label is just for the banner text, nothing is typed in at checkout.
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="promo-banner-text">Banner text</Label>
            <Button type="button" variant="ghost" size="sm" onClick={resetBannerText} className="h-6 text-xs">
              <RotateCcw className="size-3" />
              Reset to default
            </Button>
          </div>
          <Textarea
            id="promo-banner-text"
            rows={2}
            value={form.bannerText}
            onChange={(e) => setForm((f) => ({ ...f, bannerText: e.target.value }))}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving || !form.bannerText.trim() || !form.code.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
          {saved ? <span className="text-sm text-primary">Saved.</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
