"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send, TestTube2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Campaign = Database["public"]["Tables"]["email_campaigns"]["Row"];
type Recipient = Database["public"]["Tables"]["email_campaign_recipients"]["Row"];
type Lead = { email: string; companyName: string | null };

export function CampaignDetailView({
  campaign,
  recipients,
  pendingLeads,
  resendConfigured,
}: {
  campaign: Campaign;
  recipients: Recipient[];
  pendingLeads: Lead[];
  resendConfigured: boolean;
}) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult("");
    setError("");
    const res = await fetch(`/api/admin/campaigns/${campaign.id}/test`, { method: "POST" });
    const data = await res.json();
    setTesting(false);
    if (!res.ok) {
      setError(data.error ?? "Test send failed.");
      return;
    }
    setTestResult("Test sent to your own email.");
  }

  async function handleSend() {
    if (
      !window.confirm(
        `This sends a real email to ${pendingLeads.length} ${pendingLeads.length === 1 ? "person" : "people"}. This can't be undone. Continue?`
      )
    ) {
      return;
    }
    setSending(true);
    setError("");
    const res = await fetch(`/api/admin/campaigns/${campaign.id}/send`, { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "Send failed.");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm("Delete this draft campaign?")) return;
    setDeleting(true);
    await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
    router.push("/admin/campaigns");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Preview</h2>
            {campaign.sent_at ? (
              <Badge variant="outline" className="text-primary">
                Sent {new Date(campaign.sent_at).toLocaleString()}
              </Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">Subject:</span> {campaign.subject}
          </p>
          <div
            className="rounded-lg border border-border bg-secondary/20 p-4"
            dangerouslySetInnerHTML={{ __html: campaign.body }}
          />
        </CardContent>
      </Card>

      {!resendConfigured ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          <code>RESEND_API_KEY</code>/<code>RESEND_FROM_EMAIL</code>{" "}
          aren&apos;t set; sending is disabled until those are configured.
        </div>
      ) : null}

      {!campaign.sent_at ? (
        <Card>
          <CardHeader>
            <h2 className="font-medium">
              {pendingLeads.length} pending recipient{pendingLeads.length === 1 ? "" : "s"}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-muted-foreground">
              {pendingLeads.map((l) => (
                <li key={l.email}>
                  {l.email}
                  {l.companyName ? ` – ${l.companyName}` : ""}
                </li>
              ))}
              {pendingLeads.length === 0 ? <li>No one in this segment right now.</li> : null}
            </ul>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {testResult ? (
              <p className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="size-4" />
                {testResult}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !resendConfigured}>
                {testing ? <Loader2 className="size-4 animate-spin" /> : <TestTube2 className="size-4" />}
                Send test to myself
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={sending || !resendConfigured || pendingLeads.length === 0}
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send to {pendingLeads.length} recipient{pendingLeads.length === 1 ? "" : "s"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="size-4" />
                Delete draft
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="font-medium">
              Sent to {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
            </h2>
          </CardHeader>
          <CardContent>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm text-muted-foreground">
              {recipients.map((r) => (
                <li key={r.id}>
                  {r.email} – {new Date(r.sent_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
