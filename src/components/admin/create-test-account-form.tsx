"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Creates a real account (not a mock) with demo_mode on and no Stripe
// subscription anywhere in it, so it's safe to click through checkout-free —
// see /api/admin/accounts/create-test for exactly what that means. The
// sign-in link it returns is one-time and drops straight into whichever
// step a real signup would land on next (the onboarding wizard for Connect,
// the dashboard for Plus), so this exercises the actual flow, not a
// separate test-only path.
export function CreateTestAccountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("Test Co");
  const [tier, setTier] = useState<"connect" | "plus">("connect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signInUrl, setSignInUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSignInUrl(null);
    const res = await fetch("/api/admin/accounts/create-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), companyName: companyName.trim(), tier }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    if (data.signInUrl) setSignInUrl(data.signInUrl);
    else setError(data.warning ?? "Account created.");
    router.refresh();
  }

  async function copyLink() {
    if (!signInUrl) return;
    try {
      await navigator.clipboard.writeText(signInUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the link is still selectable in the field below
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Create test account
      </Button>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-sm font-semibold">Create test account</h2>
        <p className="text-xs text-muted-foreground">
          A real account with no Stripe subscription — skips checkout, drops you straight into onboarding.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="testEmail" className="text-xs">
              Email
            </Label>
            <Input
              id="testEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jsfeit+testing4@gmail.com"
              className="w-64"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testCompany" className="text-xs">
              Company name
            </Label>
            <Input
              id="testCompany"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-40"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="testTier" className="text-xs">
              Tier
            </Label>
            <select
              id="testTier"
              value={tier}
              onChange={(e) => setTier(e.target.value as "connect" | "plus")}
              className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="connect">Connect</option>
              <option value="plus">Dashboard</option>
            </select>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Create
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        {signInUrl ? (
          <div className="mt-4 space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <p className="text-sm font-medium">Account created. Sign-in link (one-time use):</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
                {signInUrl}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <a href={signInUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Button type="button" size="sm">
                  Open
                </Button>
              </a>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
