"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationConnector } from "@/components/app/integration-connector";
import { formatWinLossImportMessage, type ImportMessageData } from "@/lib/win-loss-import";

// "Bring your data": where a Connect customer lands after setup. The two
// things that make answers theirs rather than generic are their own deal
// history (a file, or pulled from a CRM/support tool) and what customers say
// when they leave.
export function ConnectDataPanel({
  competitorCount,
  connected,
  disconnectIntegrationAction,
}: {
  competitorCount: number;
  connected: { hubspot: boolean; intercom: boolean; zoom: boolean };
  disconnectIntegrationAction: (formData: FormData) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/competitors/win-loss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setMessage(formatWinLossImportMessage("Upload", data as ImportMessageData, false));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Make the answers yours</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The more I know about the deals you win and lose, the more specific every answer gets. Add it however is
          easiest. You can also just tell your assistant about a deal as it happens.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">Win/loss data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CRM export or a plain list of deals and I&apos;ll pull out the win/loss and churn reasons for each
          competitor.
        </p>
        {competitorCount === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Add a competitor first, then come back to upload here.</p>
        ) : (
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Upload a file
            </Button>
            {uploading ? (
              <p className="mt-2 text-xs text-muted-foreground">Reading it now. A large file can take a minute or two.</p>
            ) : message ? (
              <p className="mt-2 text-xs text-muted-foreground">{message}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold">Connect your tools</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only. I pull closed-lost reasons, churn and cancellation reasons, and competitor mentions from calls, and
          keep them current.
        </p>
        <div className="mt-4 space-y-3">
          <IntegrationConnector
            name="HubSpot"
            description="Closed-lost deal reasons"
            connected={connected.hubspot}
            connectHref="/api/integrations/hubspot/connect"
            provider="hubspot"
            disconnectAction={disconnectIntegrationAction}
          />
          <IntegrationConnector
            name="Intercom"
            description="Churn and cancellation reasons"
            connected={connected.intercom}
            connectHref="/api/integrations/intercom/connect"
            provider="intercom"
            disconnectAction={disconnectIntegrationAction}
          />
          <IntegrationConnector
            name="Zoom"
            description="Competitor mentions from recorded meetings"
            connected={connected.zoom}
            connectHref="/api/integrations/zoom/connect"
            provider="zoom"
            disconnectAction={disconnectIntegrationAction}
          />
          <IntegrationConnector
            name="Gong"
            description="Competitor mentions from sales calls"
            connected={false}
            connectHref="#"
            provider="gong"
            comingSoon
          />
        </div>
      </div>
    </div>
  );
}
