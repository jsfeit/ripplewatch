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

// Step 0 (MCP connect) isn't counted in "Step X of Y" — it's the thing that
// makes the purchase work at all, not one item in a setup checklist. The
// checklist starts after it, and is entirely skippable: see skipRest().
const STEP_TITLES = ["Tell it about your business", "Add competitors", "Connect Slack (optional)"];

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
  const [lostDealReasons, setLostDealReasons] = useState("");
  const [churnReasons, setChurnReasons] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorInput[]>([{ name: "", domain: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filledCompetitors = competitors.filter((c) => c.name.trim());
  const canContinueStep1 = filledCompetitors.length >= 1;

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
        lostDealReasons,
        churnReasons,
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

  async function skipRest() {
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/connect/onboarding/skip", { method: "POST" });
    if (!res.ok) {
      setSubmitting(false);
      setError("Something went wrong. Try again.");
      return;
    }
    router.push("/app/settings?tab=connect");
    router.refresh();
  }

  if (step === 0) {
    return <McpConnectStep mcpLastConnectedAt={mcpLastConnectedAt} onContinue={() => setStep(1)} />;
  }

  const wizardStep = step - 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step {wizardStep + 1} of {STEP_TITLES.length} · optional
          </p>
          <button
            type="button"
            onClick={skipRest}
            disabled={submitting}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Skip, I&apos;ll do this later
          </button>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{STEP_TITLES[wizardStep]}</h1>
        <p className="text-sm text-muted-foreground">
          {wizardStep === 0
            ? `A few things so ${companyName}'s first question to Ripplewatch already has a real answer, not a blank slate.`
            : wizardStep === 1
              ? "Name at least one competitor. Add more any time by just telling your assistant."
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
            {hasSalesCrm ? (
              <div className="space-y-2">
                <Label htmlFor="lostDealReasons">A few recent lost-deal reasons</Label>
                <Textarea
                  id="lostDealReasons"
                  value={lostDealReasons}
                  onChange={(e) => setLostDealReasons(e.target.value)}
                  placeholder="Lost to Northlane, they were $30/mo cheaper on the entry tier"
                  rows={3}
                />
              </div>
            ) : null}
            {hasPlg ? (
              <div className="space-y-2">
                <Label htmlFor="churnReasons">A few recent churn reasons</Label>
                <Textarea
                  id="churnReasons"
                  value={churnReasons}
                  onChange={(e) => setChurnReasons(e.target.value)}
                  placeholder="Churned after 2 months, said Beaconly's onboarding was easier to get started with"
                  rows={3}
                />
              </div>
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
          {wizardStep < STEP_TITLES.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={wizardStep === 1 && !canContinueStep1}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={finish} disabled={submitting || !canContinueStep1}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Done, take me to Settings
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
