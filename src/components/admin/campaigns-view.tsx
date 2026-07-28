"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Campaign = Database["public"]["Tables"]["email_campaigns"]["Row"];

const DEFAULT_SUBJECT = "Ripplewatch is open — see it in action";
const DEFAULT_BODY = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;font-size:14px;line-height:1.6;color:#1a231f;">
  <p>Hi {{company}},</p>
  <p>You signed up for the Ripplewatch waitlist a while back — it's live now and I wanted you to be one of the first to try it.</p>
  <p>Most competitive intel tools tell you <em>what</em> changed. Ripplewatch tells you whether it actually matters to your business — scored against your own positioning, ICP, and the real reasons you've won, lost, and churned deals. Not a feed to triage. A verdict you can act on.</p>
  <p>You can see it working on your own competitors before creating an account — no email required until you decide it's worth it:</p>
  <p><a href="https://ripplewatch.ai/onboarding" style="display:inline-block;padding:10px 20px;background:#0d7d6f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">See it in action</a></p>
  <p>Every plan comes with a 30-day money-back guarantee, so there's no real risk in trying it for real.</p>
  <p>Questions? Just reply — I read every one.</p>
  <p>— Jeremy</p>
</div>`;

export function CampaignsView({
  initialCampaigns,
  resendConfigured,
}: {
  initialCampaigns: Campaign[];
  resendConfigured: boolean;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("Beta launch — waitlist");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, body, segment: "waitlist_not_signed_up" }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create campaign.");
      return;
    }
    setCampaigns((prev) => [data.campaign, ...prev]);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      {!resendConfigured ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          <code>RESEND_API_KEY</code>/<code>RESEND_FROM_EMAIL</code>{" "}
          aren&apos;t set yet — you can draft campaigns now, but sending (test or real) will fail until
          those are configured.
        </div>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader>
            <h2 className="font-medium">New campaign</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaignName">Internal name</Label>
              <Input id="campaignName" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Segment</Label>
              <p className="text-sm text-muted-foreground">
                Waitlist — not yet signed up <span className="text-xs">(only segment available today)</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignSubject">Subject</Label>
              <Input id="campaignSubject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignBody">Body (HTML — {"{{company}}"} is replaced per recipient)</Label>
              <Textarea
                id="campaignBody"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="font-mono text-xs"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="button" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : null}
                Save as draft
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button type="button" onClick={() => setShowForm(true)}>
          <Plus className="size-4" />
          New campaign
        </Button>
      )}

      <div className="space-y-2">
        {campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/admin/campaigns/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.subject}</p>
              </div>
            </div>
            {c.sent_at ? (
              <Badge variant="outline" className="text-primary">
                Sent {new Date(c.sent_at).toLocaleDateString()}
              </Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            )}
          </Link>
        ))}
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : null}
      </div>
    </div>
  );
}
