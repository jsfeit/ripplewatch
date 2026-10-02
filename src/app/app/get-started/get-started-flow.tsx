"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CompetitorRow, type CompetitorInput } from "@/components/app/competitor-row";
import { IntegrationConnector } from "@/components/app/integration-connector";
import { McpConnectStep } from "@/components/app/mcp-connect-step";

const TOTAL_STEPS = 4;

// Only the Slack step is genuinely optional. Business context (positioning,
// ICP, how the team sells) is soft: the fields aren't required, but there's
// no "skip all of this" shortcut anymore, because that shortcut used to let
// someone reach Settings with zero competitors tracked, and an assistant
// with nothing to compare you against can't produce anything useful. See
// /api/connect/onboarding/complete, which has rejected a competitor-less
// submission since before this restructure.
const WIZARD_STEPS = [
  { title: "Tell it about your business", optional: true },
  { title: "Add your competitors", optional: false },
  { title: "Connect Slack", optional: true },
];

export function GetStartedFlow({
  companyName,
  mcpLastConnectedAt,
}: {
  companyName: string;
  mcpLastConnectedAt: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [positioning, setPositioning] = useState("");
  const [icp, setIcp] = useState("");
  const [hasSalesCrm, setHasSalesCrm] = useState(false);
  const [hasPlg, setHasPlg] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorInput[]>([{ name: "", domain: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filledCompetitors = competitors.filter((c) => c.name.trim());
  const hasCompetitor = filledCompetitors.length >= 1;

  function updateCompetitor(index: number, field: keyof CompetitorInput, value: string) {
    setCompetitors((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }
  function addCompetitor() {
    setCompetitors((prev) => [...prev, { name: "", domain: "" }]);
  }
  function removeCompetitor(index: number) {
    setCompetitors((prev) => prev.filter((_, i) => i !== index));
  }

  async function finish() {
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/connect/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positioning,
        icp,
        hasSalesCrm,
        hasPlg,
        competitors: filledCompetitors,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitting(false);
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }
    router.push("/app/settings?tab=connect");
    router.refresh();
  }

  if (step === 0) {
    return (
      <McpConnectStep mcpLastConnectedAt={mcpLastConnectedAt} onContinue={() => setStep(1)} />
    );
  }

  const wizardStep = step - 1;
  const { title, optional } = WIZARD_STEPS[wizardStep];

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Step {step + 1} of {TOTAL_STEPS}
          {optional ? " · optional" : ""}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {wizardStep === 0
            ? `This is what your assistant uses to judge whether something is actually relevant to ${companyName}, not just noise. Skip it and every answer defaults to generic.`
            : wizardStep === 1
              ? "Required. Your assistant can't compare you to anyone until it knows who to compare you to, and this is the one piece of setup nothing else substitutes for."
              : "Get a weekly digest in a channel, on top of asking directly. Skip this if you'd rather set it up later."}
        </p>
      </CardHeader>
      <CardContent>
        {wizardStep === 0 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="positioning">One-line positioning</Label>
              <Input
                id="positioning"
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                placeholder="Relevance-scored competitive intel for startup marketing teams"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icp">Ideal customer profile</Label>
              <Textarea
                id="icp"
                value={icp}
                onChange={(e) => setIcp(e.target.value)}
                placeholder="Marketing and product leads at 5-100 person SaaS startups without a dedicated CI function"
                rows={3}
              />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">How does your team sell? Check both if you&apos;re hybrid.</p>
              <label className="flex items-start gap-3 rounded-lg border border-border p-4">
                <Checkbox checked={hasSalesCrm} onCheckedChange={(v) => setHasSalesCrm(Boolean(v))} />
                <div>
                  <p className="text-sm font-medium">We have a sales team / CRM</p>
                  <p className="text-xs text-muted-foreground">We run sales-led or hybrid deals through a CRM.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-4">
                <Checkbox checked={hasPlg} onCheckedChange={(v) => setHasPlg(Boolean(v))} />
                <div>
                  <p className="text-sm font-medium">We&apos;re self-serve / PLG</p>
                  <p className="text-xs text-muted-foreground">Customers sign up and churn without a sales conversation.</p>
                </div>
              </label>
            </div>
            {hasSalesCrm || hasPlg ? (
              <p className="text-xs text-muted-foreground">
                Add win/loss and churn reasons once you&apos;re set up: tell your assistant directly, or upload a CRM
                export from Settings → Connect.
              </p>
            ) : null}
          </div>
        )}

        {wizardStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              {competitors.map((c, i) => (
                <CompetitorRow
                  key={i}
                  value={c}
                  onChange={(field, val) => updateCompetitor(i, field, val)}
                  onRemove={() => removeCompetitor(i)}
                  removeDisabled={competitors.length <= 1}
                />
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCompetitor}>
              <Plus className="size-4" />
              Add competitor
            </Button>
          </div>
        )}

        {wizardStep === 2 ? (
          <IntegrationConnector
            name="Slack"
            description="Deliver a weekly digest to a channel"
            connected={false}
            connectHref="/api/integrations/slack/connect"
            provider="slack"
          />
        ) : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <div className="mt-6 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {wizardStep < WIZARD_STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={wizardStep === 1 && !hasCompetitor}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={finish} disabled={submitting || !hasCompetitor}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Done, take me to Settings
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
