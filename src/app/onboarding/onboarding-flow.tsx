"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Sparkles,
  Check,
  Building2,
  Users,
  Radar,
  Mail,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MockConnectorCard } from "@/components/app/mock-connector-card";
import { CompetitorRow, type CompetitorInput } from "@/components/app/competitor-row";
import { SuggestedCompetitors, type SuggestedCompetitor } from "@/components/app/suggested-competitors";
import { DocumentUpload } from "@/components/app/document-upload";
import { generatePreviewAlert } from "@/lib/onboarding-preview";
import { DOMAIN_PATTERN } from "@/lib/domain";
import { createClient } from "@/lib/supabase/client";

const MAX_COMPETITORS = 15;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OnboardingFlow({ initiallySignedIn }: { initiallySignedIn: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get("plan");
  const selectedPeriod = searchParams.get("period") === "annual" ? "annual" : "monthly";
  const [step, setStep] = useState(0);

  const STEPS = useMemo(() => {
    const base = [
      { title: "Company basics", icon: Building2 },
      { title: "Competitors", icon: Radar },
      { title: "Growth Monitoring", icon: Users },
      { title: "Live preview", icon: Sparkles },
    ];
    return initiallySignedIn ? base : [...base, { title: "Create account", icon: Mail }];
  }, [initiallySignedIn]);
  const STEP_TITLES = STEPS.map((s) => s.title);
  const isFinalStep = step === STEPS.length - 1;
  const isAccountStep = !initiallySignedIn && isFinalStep;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [positioning, setPositioning] = useState("");
  const [icp, setIcp] = useState("");

  const [competitors, setCompetitors] = useState<CompetitorInput[]>([
    { name: "", domain: "" },
    { name: "", domain: "" },
    { name: "", domain: "" },
  ]);

  const [hasSalesCrm, setHasSalesCrm] = useState(false);
  const [hasPlg, setHasPlg] = useState(false);
  const [crmConnected, setCrmConnected] = useState(false);
  const [lostDealReasons, setLostDealReasons] = useState("");
  const [churnToolConnected, setChurnToolConnected] = useState(false);
  const [churnReasons, setChurnReasons] = useState("");
  const [slackConnected, setSlackConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // null = not fetched yet (derives the loading state below), [] = fetched
  // but empty, array = loaded.
  const [suggestions, setSuggestions] = useState<SuggestedCompetitor[] | null>(null);
  const suggestionsFetchedRef = useRef(false);
  const suggestionsLoading = step === 1 && suggestions === null && companyName.trim().length > 0;

  const filledCompetitors = competitors.filter((c) => c.name.trim().length > 0);
  const domainsValid = competitors.every((c) => !c.domain.trim() || DOMAIN_PATTERN.test(c.domain.trim()));

  const canProceed = useMemo(() => {
    if (step === 0) return companyName.trim() && positioning.trim() && icp.trim();
    if (step === 1) return filledCompetitors.length >= 3 && domainsValid;
    if (step === 2) return hasSalesCrm || hasPlg;
    if (isAccountStep) return EMAIL_PATTERN.test(email.trim()) && password.length >= 6;
    return true;
  }, [
    step,
    companyName,
    positioning,
    icp,
    filledCompetitors.length,
    domainsValid,
    hasSalesCrm,
    hasPlg,
    isAccountStep,
    email,
    password,
  ]);

  const previewAlert = useMemo(
    () =>
      generatePreviewAlert({
        companyName,
        positioning,
        icp,
        competitorName: filledCompetitors[0]?.name ?? "",
        lossReason: lostDealReasons || churnReasons,
      }),
    [companyName, positioning, icp, filledCompetitors, lostDealReasons, churnReasons]
  );

  function updateCompetitor(index: number, field: keyof CompetitorInput, value: string) {
    setCompetitors((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addCompetitor() {
    if (competitors.length >= MAX_COMPETITORS) return;
    setCompetitors((prev) => [...prev, { name: "", domain: "" }]);
  }

  function removeCompetitor(index: number) {
    setCompetitors((prev) => prev.filter((_, i) => i !== index));
  }

  // Fetched once, the first time the user reaches the Competitors step —
  // needs company name from step 0, so it can't run any earlier.
  useEffect(() => {
    if (!suggestionsLoading || suggestionsFetchedRef.current) return;
    suggestionsFetchedRef.current = true;

    fetch("/api/onboarding/suggest-competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, positioning, icp }),
    })
      .then((res) => res.json())
      .then((data) => setSuggestions(data.competitors ?? []))
      .catch(() => setSuggestions([]));
  }, [suggestionsLoading, companyName, positioning, icp]);

  function toggleSuggestion(suggestion: SuggestedCompetitor) {
    const key = suggestion.name.trim().toLowerCase();
    setCompetitors((prev) => {
      const existingIndex = prev.findIndex((c) => c.name.trim().toLowerCase() === key);
      if (existingIndex !== -1) {
        return prev.filter((_, i) => i !== existingIndex);
      }
      const emptyIndex = prev.findIndex((c) => !c.name.trim());
      if (emptyIndex !== -1) {
        return prev.map((c, i) => (i === emptyIndex ? { name: suggestion.name, domain: suggestion.domain } : c));
      }
      if (prev.length >= MAX_COMPETITORS) return prev;
      return [...prev, { name: suggestion.name, domain: suggestion.domain }];
    });
  }

  const selectedSuggestionNames = useMemo(
    () => new Set(competitors.map((c) => c.name.trim().toLowerCase()).filter(Boolean)),
    [competitors]
  );

  async function handleFinish() {
    setSubmitting(true);
    setSubmitError("");

    if (!initiallySignedIn) {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/app/dashboard` },
      });

      if (error) {
        setSubmitError(error.message);
        setSubmitting(false);
        return;
      }

      // Email confirmation is off in dev, but if it's ever re-enabled there's
      // no session yet — nothing to persist the onboarding data against.
      if (!data.session) {
        setNeedsConfirmation(true);
        setSubmitting(false);
        return;
      }
    }

    await completeOnboarding();
  }

  async function completeOnboarding() {
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          positioning,
          icp,
          competitors,
          hasSalesCrm,
          hasPlg,
          lostDealReasons,
          churnReasons,
          crmConnected,
          churnToolConnected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      if (selectedPlan === "starter" || selectedPlan === "plus") {
        const checkoutRes = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: selectedPlan, period: selectedPeriod }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.url) {
          window.location.href = checkoutData.url;
          return;
        }
        // Checkout couldn't start (e.g. Stripe not fully configured yet) —
        // the account still exists, so fall through to the dashboard rather
        // than stranding the user on an error.
      }

      router.push("/app/dashboard");
      router.refresh();
    } catch {
      setSubmitError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="size-8 text-primary" />
          <p className="font-medium">Check your email</p>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to {email}. Follow it to finish setting up your account and see
            your dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-10 flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                      ? "border-primary bg-background text-primary"
                      : "border-border bg-background text-muted-foreground"
                )}
              >
                {i < step ? <Check className="size-4" /> : <s.icon className="size-4" />}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:block",
                  i <= step ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                  i < step ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
          </div>
        ))}
      </div>

      <Card key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CardHeader>
          <h1 className="text-xl font-semibold">{STEP_TITLES[step]}</h1>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>
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
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add 3–{MAX_COMPETITORS} competitors by name and domain.
              </p>
              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <CompetitorRow
                    key={i}
                    value={c}
                    onChange={(field, val) => updateCompetitor(i, field, val)}
                    onRemove={() => removeCompetitor(i)}
                    removeDisabled={competitors.length <= 3}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCompetitor}
                disabled={competitors.length >= MAX_COMPETITORS}
              >
                <Plus className="size-4" />
                Add competitor
              </Button>
              <p className="text-xs text-muted-foreground">
                {filledCompetitors.length}/{MAX_COMPETITORS} named — minimum 3 required
              </p>

              <SuggestedCompetitors
                suggestions={suggestions}
                loading={suggestionsLoading}
                selectedNames={selectedSuggestionNames}
                onToggle={toggleSuggestion}
              />

              <div className="border-t border-border pt-4">
                {initiallySignedIn ? (
                  <DocumentUpload />
                ) : (
                  <div>
                    <p className="text-sm font-medium">Attach supporting documents (optional)</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Available once you create your account, at the end of this demo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                How does your team sell? Check both if you&apos;re hybrid.
              </p>
              <div className="space-y-3">
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

              <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                <div>
                  <p className="text-sm font-medium">Connect Slack</p>
                  <p className="text-xs text-muted-foreground">
                    We push every relevant signal straight to the channel of your choice — no one
                    has to log in to Ripplewatch to know what changed.
                  </p>
                </div>
                <MockConnectorCard
                  name="Slack"
                  description="Connect after setup, from Settings — deliver scored alerts to a channel"
                  connected={slackConnected}
                  onConnect={() => setSlackConnected(true)}
                />
              </div>

              {hasSalesCrm && (
                <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm font-medium">Connect your CRM</p>
                  <MockConnectorCard
                    name="HubSpot"
                    description="Connect after setup, from Settings — read-only pull of closed-lost deal reasons"
                    connected={crmConnected}
                    onConnect={() => setCrmConnected(true)}
                  />
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="lostDealReasons">Or paste a few recent lost-deal reasons</Label>
                    <Textarea
                      id="lostDealReasons"
                      value={lostDealReasons}
                      onChange={(e) => setLostDealReasons(e.target.value)}
                      placeholder="Lost to Parano.ai — they were $30/mo cheaper on the entry tier"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {hasPlg && (
                <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm font-medium">Connect your churn / support tool</p>
                  <MockConnectorCard
                    name="Intercom"
                    description="Read-only pull of churn and cancellation reasons"
                    connected={churnToolConnected}
                    onConnect={() => setChurnToolConnected(true)}
                  />
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="churnReasons">Or paste a few recent churn reasons</Label>
                    <Textarea
                      id="churnReasons"
                      value={churnReasons}
                      onChange={(e) => setChurnReasons(e.target.value)}
                      placeholder="Churned after 2 months — said RivalSense's onboarding was easier to get started with"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Here&apos;s a live sample of the kind of alert you&apos;ll get — updating as you filled in
                your context. Real signals will replace this once monitoring is live.
              </p>
              <div
                key={previewAlert.headline + previewAlert.reasoning}
                className="animate-in fade-in slide-in-from-bottom-1 rounded-lg border border-primary/25 bg-card p-4 duration-300"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Sparkles className="size-3.5" />
                  Scored alert preview
                </div>
                <p className="mt-3 text-sm font-medium">{previewAlert.headline}</p>
                <div className="mt-3 rounded-md border border-primary/20 bg-accent/60 p-3">
                  <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    High relevance
                  </span>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">{previewAlert.reasoning}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{companyName || "Your company"}</span> ·{" "}
                  {filledCompetitors.length} competitors tracked · growth monitoring:{" "}
                  {hasSalesCrm && hasPlg ? "Hybrid" : hasSalesCrm ? "Sales-led" : hasPlg ? "Self-serve" : "Not set"}
                </p>
              </div>
              {!initiallySignedIn ? (
                <p className="text-sm font-medium text-primary">Like what you see? Save it — one step left.</p>
              ) : null}
            </div>
          )}

          {isAccountStep && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a free account to save this setup and start monitoring these competitors for real.
                No card required.
              </p>
              <div className="space-y-2">
                <Label htmlFor="onboardingEmail">Work email</Label>
                <Input
                  id="onboardingEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboardingPassword">Password</Label>
                <Input
                  id="onboardingPassword"
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                By creating an account, you agree to our{" "}
                <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {submitError ? <p className="mt-4 text-sm text-destructive">{submitError}</p> : null}

      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        {step < STEP_TITLES.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleFinish} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {isAccountStep ? "Create account & go to dashboard" : "Go to dashboard"}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
