"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Copy, Check, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CONNECT_MCP_URL } from "@/lib/connect";
import { timeAgo } from "@/lib/date";
import { cn } from "@/lib/utils";

// The first thing a Connect account sees after checkout: get the assistant
// talking to Ripplewatch before anything else, the way Firecrawl and other
// MCP-first products lead with "connect your agent" rather than a form.
// Everything else (positioning, competitors, Slack) is useful but optional —
// this is the one step that makes the purchase actually do something.
export function McpConnectStep({
  mcpLastConnectedAt,
  onContinue,
}: {
  mcpLastConnectedAt: string | null;
  onContinue: () => void;
}) {
  const router = useRouter();
  const connected = Boolean(mcpLastConnectedAt);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  useEffect(() => {
    // Poll for the moment /api/mcp records a real authenticated request,
    // same staggered pattern as the Connect settings tab — no socket, just
    // a few refreshes while this screen is actually being looked at.
    if (connected) return;
    const timers = [3000, 6000, 10000, 15000, 20000].map((ms) => setTimeout(() => router.refresh(), ms));
    return () => timers.forEach(clearTimeout);
  }, [connected, router]);

  async function copyText(text: string, setCopied: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the text is still selectable on screen
    }
  }

  async function ensureApiKey() {
    if (apiKey || keyLoading) return apiKey;
    setKeyLoading(true);
    setKeyError("");
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Get started" }),
      });
      const data = await res.json();
      if (!res.ok || !data.key) throw new Error(data.error ?? "Could not create a key.");
      setApiKey(data.key as string);
      return data.key as string;
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Could not create a key.");
      return null;
    } finally {
      setKeyLoading(false);
    }
  }

  const claudeCodeCommand = `claude mcp add --transport http ripplewatch ${CONNECT_MCP_URL} \\\n  --header "Authorization: Bearer ${apiKey ?? "<generate a key below>"}"`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Connect your assistant</h1>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              connected ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
            )}
          >
            {connected ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
            {connected ? `Connected · active ${timeAgo(mcpLastConnectedAt!)}` : "Not connected yet"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          This is what you paid for — pick where you work and wire it up. Takes about a minute.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="claude">
          <TabsList>
            <TabsTrigger value="claude">Claude</TabsTrigger>
            <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
            <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
            <TabsTrigger value="other">Other / API key</TabsTrigger>
          </TabsList>

          <TabsContent value="claude" className="mt-4">
            <Steps
              url={CONNECT_MCP_URL}
              copied={copiedUrl}
              onCopy={() => copyText(CONNECT_MCP_URL, setCopiedUrl)}
              clientSteps={[
                "Go to Settings → Connectors → Add custom connector.",
                "Paste the URL. If it shows Authentication/OAuth client options, leave the detected defaults and continue.",
                "Sign in to Ripplewatch and approve when it asks.",
              ]}
              note="Already added this once and it's not prompting you to sign in? Remove the existing connector first, then add it fresh — editing an existing one can reuse a stale login."
            />
          </TabsContent>

          <TabsContent value="chatgpt" className="mt-4">
            <Steps
              url={CONNECT_MCP_URL}
              copied={copiedUrl}
              onCopy={() => copyText(CONNECT_MCP_URL, setCopiedUrl)}
              clientSteps={[
                "Go to Settings → Connectors → Advanced → Add custom connector.",
                "Paste the URL. If it shows Authentication/OAuth client options, leave the detected defaults and continue.",
                "Sign in to Ripplewatch and approve when it asks.",
              ]}
              note="Already added this once and it's not prompting you to sign in? Remove the existing connector first, then add it fresh — editing an existing one can reuse a stale login."
            />
          </TabsContent>

          <TabsContent value="claude-code" className="mt-4 space-y-4">
            <div>
              <p className="text-sm">
                Run this in your terminal. It needs an API key — generate one below if you haven&apos;t yet.
              </p>
              <div className="mt-2 flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
                  <code>{claudeCodeCommand}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={keyLoading}
                  onClick={async () => {
                    const key = apiKey ?? (await ensureApiKey());
                    if (key) copyText(claudeCodeCommand.replace("<generate a key below>", key), setCopiedCommand);
                  }}
                >
                  {keyLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : copiedCommand ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {keyLoading ? "Generating" : copiedCommand ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <ApiKeyBlock
              apiKey={apiKey}
              keyLoading={keyLoading}
              keyError={keyError}
              copiedKey={copiedKey}
              onGenerate={ensureApiKey}
              onCopy={() => apiKey && copyText(apiKey, setCopiedKey)}
            />
          </TabsContent>

          <TabsContent value="other" className="mt-4 space-y-4">
            <div>
              <p className="text-sm">Any MCP-compatible client: point it at this URL with the key as a bearer token.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
                  {CONNECT_MCP_URL}
                </code>
                <Button variant="outline" size="sm" onClick={() => copyText(CONNECT_MCP_URL, setCopiedUrl)}>
                  {copiedUrl ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedUrl ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <ApiKeyBlock
              apiKey={apiKey}
              keyLoading={keyLoading}
              keyError={keyError}
              copiedKey={copiedKey}
              onGenerate={ensureApiKey}
              onCopy={() => apiKey && copyText(apiKey, setCopiedKey)}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {connected ? "You're set — the rest is optional." : "You can finish this later from Settings → Connect."}
          </p>
          <Button onClick={onContinue}>
            Continue
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Steps({
  url,
  copied,
  onCopy,
  clientSteps,
  note,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
  clientSteps: string[];
  note?: string;
}) {
  return (
    <>
      <ol className="space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            1
          </span>
          <div className="min-w-0 flex-1">
            <p>Copy this URL.</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
                {url}
              </code>
              <Button variant="outline" size="sm" onClick={onCopy}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </li>
        {clientSteps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 2}
            </span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      {note ? <p className="mt-4 text-xs text-muted-foreground">{note}</p> : null}
    </>
  );
}

function ApiKeyBlock({
  apiKey,
  keyLoading,
  keyError,
  copiedKey,
  onGenerate,
  onCopy,
}: {
  apiKey: string | null;
  keyLoading: boolean;
  keyError: string;
  copiedKey: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  if (!apiKey) {
    return (
      <div>
        <Button type="button" variant="outline" size="sm" onClick={onGenerate} disabled={keyLoading}>
          {keyLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Generate an API key
        </Button>
        {keyError ? <p className="mt-2 text-sm text-destructive">{keyError}</p> : null}
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">Copy this now — it won&apos;t be shown again.</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
          {apiKey}
        </code>
        <Button variant="outline" size="sm" onClick={onCopy}>
          {copiedKey ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copiedKey ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
