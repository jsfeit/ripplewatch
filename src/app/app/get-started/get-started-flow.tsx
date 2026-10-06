"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CompetitorRow, type CompetitorInput } from "@/components/app/competitor-row";
import { IntegrationConnector } from "@/components/app/integration-connector";
import { Confetti } from "@/components/app/confetti";
import { McpConnectStep } from "@/components/app/mcp-connect-step";
import { HowItFits } from "@/components/app/how-it-fits";
import { DEAL_TOOLS, loadDealTools, saveDealTools } from "@/lib/deal-tools";
import { cn } from "@/lib/utils";
import { ONBOARDING_VALUE, type OnboardingStepKey } from "@/lib/onboarding-value";

const TOTAL_STEPS = 5;

// Only the Slack step is genuinely optional. Business context (positioning,
// ICP, how the team sells) is soft: the fields aren't required, but there's
// no "skip all of this" shortcut anymore, because that shortcut used to let
// someone reach Settings with zero competitors tracked, and an assistant
// with nothing to compare you against can't produce anything useful. See
// /api/connect/onboarding/complete, which has rejected a competitor-less
// submission since before this restructure.
const WIZARD_STEPS: { title: string; optional: boolean; key: OnboardingStepKey }[] = [
  { title: "Tell it about your business", optional: true, key: "business" },
  { title: "Add your competitors", optional: false, key: "competitors" },
  { title: "Where do your deals live?", optional: true, key: "tools" },
  { title: "Connect Slack", optional: true, key: "slack" },
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
  // What the step just finished made better, shown at the top of the next one.
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  const [positioning, setPositioning] = useState("");
  const [icp, setIcp] = useState("");
  const [hasSalesCrm, setHasSalesCrm] = useState(false);
  const [hasPlg, setHasPlg] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorInput[]>([{ name: "", domain: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  // This browser's saved choice. Read lazily and only on the client; the chips
  // that show it appear on a later step, so the server render never differs.
  const [dealTools, setDealTools] = useState<string[]>(() => (typeof window === "undefined" ? [] : loadDealTools()));

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
    // Let the confetti land before moving on, then go to where the next
    // useful thing is: bringing their own deal data in.
    setCelebrating(true);
    setTimeout(() => {
      router.push("/app/settings?tab=data");
      router.refresh();
    }, 2400);
  }

  if (step === 0) {
    return (
      <McpConnectStep
        mcpLastConnectedAt={mcpLastConnectedAt}
        totalSteps={TOTAL_STEPS}
        onContinue={() => {
          setJustUnlocked(ONBOARDING_VALUE.connect.unlocked());
          setStep(1);
        }}
      />
    );
  }

  if (celebrating) {
    return (
      <>
        <Confetti />
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold tracking-tight">You&apos;re all set, {companyName}.</h1>
            <p className="text-sm text-muted-foreground">
              {`I'm checking ${filledCompetitors.length} competitor${filledCompetitors.length === 1 ? "" : "s"} now. Next, let's make the answers yours.`}
            </p>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Taking you there…
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const wizardStep = step - 1;
  const { title, optional, key } = WIZARD_STEPS[wizardStep];

  function advance() {
    // Only celebrate what actually happened: a blank business step unlocked nothing.
    if (wizardStep === 0) {
      setJustUnlocked(positioning.trim() || icp.trim() ? ONBOARDING_VALUE.business.unlocked() : null);
    } else if (wizardStep === 1) {
      setJustUnlocked(ONBOARDING_VALUE.competitors.unlocked(filledCompetitors.length));
    } else if (wizardStep === 2) {
      // Remembered in this browser so the Data tab can name these tools in its prompts.
      saveDealTools(dealTools);
      setJustUnlocked(dealTools.length > 0 ? ONBOARDING_VALUE.tools.unlocked() : null);
    }
    setStep((s) => s + 1);
  }

  return (
    <Card>
      <CardHeader>
        {justUnlocked ? (
          <p className="mb-1 flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {justUnlocked}
          </p>
        ) : null}
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
              : wizardStep === 2
                ? "Your deals are what make answers specific to you. If they live in a tool your assistant can reach, it can pull them in for you."
                : "Slack is the shared feed: alerts and recaps land in a channel your whole team sees. Skip it if you're the only one using Ripplewatch."}
        </p>
        <p className="mt-1 rounded-md bg-primary/[0.06] px-3 py-2 text-sm">{ONBOARDING_VALUE[key].unlocks}</p>
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pick any that apply. You can change this later in Settings, under Data.</p>
            <div className="flex flex-wrap gap-2">
              {DEAL_TOOLS.map((t) => {
                const on = dealTools.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDealTools((cur) => (on ? cur.filter((id) => id !== t.id) : [...cur, t.id]))}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium",
                      on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Don&apos;t see yours, or don&apos;t use any? That&apos;s fine: you can always just tell your assistant how a
              deal went.
            </p>
          </div>
        ) : null}

        {wizardStep === 3 ? (
          <div className="space-y-4">
            <HowItFits />
            <IntegrationConnector
              name="Slack"
              description="Post alerts and recaps to a channel your team sees"
              connected={false}
              connectHref="/api/integrations/slack/connect"
              provider="slack"
            />
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <div className="mt-6 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={() => {
              setJustUnlocked(null);
              setStep((s) => Math.max(0, s - 1));
            }}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {wizardStep < WIZARD_STEPS.length - 1 ? (
            <Button type="button" onClick={advance} disabled={wizardStep === 1 && !hasCompetitor}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={finish} disabled={submitting || !hasCompetitor}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Finish setup
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
