"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CompetitorRow, type CompetitorInput } from "@/components/app/competitor-row";
import { Confetti } from "@/components/app/confetti";
import { DealsImportCard, FirstQuestions } from "@/components/app/first-questions";
import { QuickGuide } from "@/components/app/quick-guide";
import { McpConnectStep } from "@/components/app/mcp-connect-step";
import { MomentumTease, ReadinessMeter, type Skill } from "@/components/app/momentum-tease";
import { MomentumBoardLive } from "@/components/app/momentum-board-live";
import { SuggestedCompetitors, type SuggestedCompetitor } from "@/components/app/suggested-competitors";
import { PersonalReadCard } from "@/components/app/personal-read-card";
import { SlackStep } from "@/components/app/slack-step";
import { clearIntro, loadIntro } from "@/lib/connect-intro";
import { trackEvent } from "@/lib/analytics";
import { ONBOARDING_VALUE, type OnboardingStepKey } from "@/lib/onboarding-value";
import { dataCopy, type Audience } from "@/lib/sales-motion";
import { AudiencePicker, saveSellsTo } from "@/components/app/audience-picker";
import { SetupDataStep } from "@/components/app/setup-data-step";

const TOTAL_STEPS = 5;

// Only the Slack step is genuinely optional. Business context (positioning,
// ICP) is soft: the fields aren't required, but there's
// no "skip all of this" shortcut anymore, because that shortcut used to let
// someone reach Settings with zero competitors tracked, and an assistant
// with nothing to compare you against can't produce anything useful. See
// /api/connect/onboarding/complete, which has rejected a competitor-less
// submission since before this restructure.
const WIZARD_STEPS: { title: string; optional: boolean; key: OnboardingStepKey }[] = [
  { title: "Tell it about your business", optional: true, key: "business" },
  { title: "Add your competitors", optional: false, key: "competitors" },
  { title: "Add your deals", optional: true, key: "tools" },
  { title: "Connect Slack", optional: true, key: "slack" },
];

// Where connecting the assistant sits among the steps shown: after the context
// and a competitor are saved (so the first crawl is already running), before
// the optional ones. WIZARD_STEPS holds every step except this one.
const CONNECT_STEP = 2;
const wizardIndex = (step: number) => (step < CONNECT_STEP ? step : step - 1);

export function GetStartedFlow({
  companyName,
  mcpLastConnectedAt,
  connectedAssistants,
  contextSaved,
  savedCompetitorName,
  initialWebsite,
  initialSellsTo,
  initialOverview,
  savedCompetitors,
  savedPositioning,
  savedIcp,
}: {
  companyName: string;
  mcpLastConnectedAt: string | null;
  // Assistants recorded as connected, so "Open in ..." only offers those.
  connectedAssistants: string[];
  // Business context and competitors are already saved (a reload partway through).
  contextSaved: boolean;
  savedCompetitorName: string | null;
  // Saved earlier on the account, so a reload keeps them.
  initialWebsite: string | null;
  initialSellsTo: Audience | null;
  initialOverview: string | null;
  // What was saved when the competitors step was passed, so going Back (or reloading) shows it.
  savedCompetitors: CompetitorInput[];
  savedPositioning: string | null;
  savedIcp: string | null;
}) {
  const router = useRouter();
  // Order: business, competitors (saved here), connect, deals, Slack. Someone who
  // already saved their context resumes at connect, or just past it if connected.
  const [step, setStep] = useState(contextSaved ? (mcpLastConnectedAt ? CONNECT_STEP + 1 : CONNECT_STEP) : 0);
  // Step 0 connects the assistant; the rest follow WIZARD_STEPS. One event per step
  // shown, so Google Analytics can draw the setup funnel for visitors who accepted cookies.
  useEffect(() => {
    trackEvent("setup_step_viewed", { step: step === CONNECT_STEP ? "connect" : (WIZARD_STEPS[wizardIndex(step)]?.key ?? "done"), step_number: step + 1 });
  }, [step]);
  // What the step just finished made better, shown at the top of the next one.
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  // What they told us on the free read before signing up, if they did it in this
  // browser. Used to start the steps below filled in and to show the read again
  // at the end. Read once on the client, so the server render is the empty one.
  const [intro] = useState(() => (typeof window === "undefined" ? null : loadIntro()));
  const [positioning, setPositioning] = useState(savedPositioning ?? intro?.positioning ?? "");
  const [icp, setIcp] = useState(savedIcp ?? intro?.icp ?? "");
  // Three rows to start, so it's clear more than one is expected; more can be added.
  // Competitors already saved are listed, not edited here (they carry history, so renaming or removing
  // one is done in Settings). The rows below only ever hold ones that are still to be added.
  const [savedList, setSavedList] = useState<CompetitorInput[]>(savedCompetitors);
  const [competitors, setCompetitors] = useState<CompetitorInput[]>(
    savedCompetitors.length > 0
      ? [{ name: "", domain: "" }]
      : [
          intro?.competitor ? { name: intro.competitor.name, domain: intro.competitor.domain } : { name: "", domain: "" },
          { name: "", domain: "" },
          { name: "", domain: "" },
        ]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  // A deal told in plain words on the deals step, saved with everything else at the end.
  const [dealNote, setDealNote] = useState("");
  // Churn told in plain words on the consumer side, saved with the deal note at the end.
  const [consumerNote, setConsumerNote] = useState("");
  const [metricsSaved, setMetricsSaved] = useState(false);
  // Stable, because the data step calls these from an effect when the assistant has saved something.
  const markMetrics = useCallback(() => setMetricsSaved(true), []);
  // Who they sell to decides the wording and tools on the deals step. Saved on the account.
  const [sellsTo, setSellsTo] = useState<Audience | null>(initialSellsTo);
  const copy = dataCopy(sellsTo);
  function chooseSellsTo(next: Audience) {
    setSellsTo(next);
    saveSellsTo(next);
  }
  // What was read from their website: a short overview, a default for sells-to, and suggested
  // positioning and customer lines that only ever fill empty fields.
  const [website, setWebsite] = useState(initialWebsite ?? "");
  const [overview, setOverview] = useState<string | null>(initialOverview);
  const [overviewState, setOverviewState] = useState<"idle" | "reading" | "done" | "failed">(initialOverview ? "done" : "idle");
  const [overviewError, setOverviewError] = useState("");
  const [sellsToNote, setSellsToNote] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<{ positioning: string; icp: string } | null>(null);
  const lastLookup = useRef<string>(initialWebsite ?? "");
  // With both, the two notes are labelled by side so they read back clearly.
  const noteToSave =
    sellsTo === "both"
      ? [dealNote.trim() && `Business deal: ${dealNote.trim()}`, consumerNote.trim() && `Churned customers: ${consumerNote.trim()}`].filter(Boolean).join("\n")
      : sellsTo === "consumer"
        ? consumerNote
        : dealNote;

  async function lookupCompany() {
    const site = website.trim();
    if (!site || site === lastLookup.current) return;
    lastLookup.current = site;
    setOverviewState("reading");
    setOverviewError("");
    try {
      const res = await fetch("/api/connect/company-overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: site }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.overview) {
        setOverviewState("failed");
        setOverviewError(data.error ?? "I couldn't read that site. You can describe the business below instead.");
        return;
      }
      const o = data.overview as { overview: string; sellsTo: Audience; sellsToUnsure: boolean; sellsToReason: string; positioning: string; icp: string };
      setOverview(o.overview);
      setOverviewState("done");
      // Only ever fill what is empty. Anything already typed stays, with the suggestion offered beside it.
      const keep: { positioning: string; icp: string } = { positioning: "", icp: "" };
      if (!positioning.trim()) setPositioning(o.positioning);
      else if (o.positioning && o.positioning !== positioning) keep.positioning = o.positioning;
      if (!icp.trim()) setIcp(o.icp);
      else if (o.icp && o.icp !== icp) keep.icp = o.icp;
      setSuggested(keep.positioning || keep.icp ? keep : null);
      // The default only applies when they haven't chosen yet.
      if (!sellsTo) {
        chooseSellsTo(o.sellsTo);
        setSellsToNote(
          o.sellsToUnsure
            ? "I couldn't tell from your site, so I picked Both. Change it if that's wrong."
            : `${o.sellsToReason ? `${o.sellsToReason.replace(/\.$/, "")}. ` : ""}Change it if that's wrong.`
        );
      }
    } catch {
      setOverviewState("failed");
      setOverviewError("I couldn't reach Ripplewatch. You can describe the business below instead.");
    }
  }
  // A deal export uploaded on the deals step: committed as soon as it is confirmed, not at the end.
  const [uploadedDeals, setUploadedDeals] = useState(false);
  const markDeals = useCallback(() => setUploadedDeals(true), []);
  const [dealResult, setDealResult] = useState<{ imported: number; skipped: number } | null>(null);

  const filledCompetitors = competitors.filter((c) => c.name.trim());
  const hasCompetitor = filledCompetitors.length >= 1 || savedList.length >= 1;
  // Everyone being watched, saved or about to be, for the prompts and the first question.
  const allCompetitorNames = [...savedList, ...filledCompetitors].map((c) => c.name.trim()).filter(Boolean);
  const leadCompetitor = allCompetitorNames[0] ?? savedCompetitorName;
  // A progress cue built only from what's been told so far.
  const readiness =
    (mcpLastConnectedAt ? 30 : 0) +
    (positioning.trim() || icp.trim() ? 20 : 0) +
    (hasCompetitor ? 35 : 0) +
    (dealNote.trim() || consumerNote.trim() || uploadedDeals || metricsSaved ? 15 : 0);

  // Likely competitors (they need what was said about the business). The call takes a few
  // seconds, so it starts on the business step: once they've written a real sentence and
  // paused, it runs once in the background. Opening the competitors step only asks again if
  // what they wrote changed since. null = not asked yet, [] = nothing to suggest.
  const [suggestions, setSuggestions] = useState<SuggestedCompetitor[] | null>(null);
  const suggestionsKeyRef = useRef<string | null>(null);
  const prefetchedRef = useRef(false);
  const onCompetitorsStep = step === 1;

  function askForSuggestions() {
    const key = [positioning, icp].map((s) => s.trim()).join("|");
    if (suggestionsKeyRef.current === key) return;
    suggestionsKeyRef.current = key;
    fetch("/api/onboarding/suggest-competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, positioning, icp }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (suggestionsKeyRef.current === key) setSuggestions(Array.isArray(data.competitors) ? data.competitors : []);
      })
      .catch(() => {
        if (suggestionsKeyRef.current === key) setSuggestions([]);
      });
  }

  useEffect(() => {
    if (step !== 0 || prefetchedRef.current || positioning.trim().length < 15) return;
    const timer = setTimeout(() => {
      prefetchedRef.current = true;
      askForSuggestions();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, positioning, icp]);

  useEffect(() => {
    if (!onCompetitorsStep) return;
    const key = [positioning, icp].map((s) => s.trim()).join("|");
    if (suggestionsKeyRef.current === key) return;
    setSuggestions(null);
    askForSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCompetitorsStep, companyName, positioning, icp]);

  function toggleSuggestion(suggestion: SuggestedCompetitor) {
    const key = suggestion.name.trim().toLowerCase();
    setCompetitors((prev) => {
      const at = prev.findIndex((c) => c.name.trim().toLowerCase() === key);
      if (at !== -1) {
        const rest = prev.filter((_, i) => i !== at);
        return rest.length > 0 ? rest : [{ name: "", domain: "" }];
      }
      const empty = prev.findIndex((c) => !c.name.trim());
      if (empty !== -1) return prev.map((c, i) => (i === empty ? { name: suggestion.name, domain: suggestion.domain } : c));
      return [...prev, { name: suggestion.name, domain: suggestion.domain }];
    });
  }
  const selectedNames = useMemo(
    () => new Set([...savedList, ...competitors].map((c) => c.name.trim().toLowerCase()).filter(Boolean)),
    [competitors, savedList]
  );
  const domainByName = useMemo(
    () => Object.fromEntries(competitors.filter((c) => c.name.trim() && c.domain.trim()).map((c) => [c.name.trim(), c.domain.trim()])),
    [competitors]
  );

  // What the analyst can do so far; each tile is a real capability that turns on from what's been entered.
  const skills: Skill[] = [
    { label: "Briefings", on: Boolean(mcpLastConnectedAt) && hasCompetitor, hint: "Needs your assistant connected and a competitor" },
    { label: "Momentum", on: hasCompetitor, hint: "Needs at least one competitor" },
    { label: "Relevance scoring", on: Boolean(positioning.trim() || icp.trim()), hint: "Needs what you sell or who buys it" },
    sellsTo === "consumer"
      ? { label: "Churn-aware answers", on: metricsSaved || Boolean(consumerNote.trim()) || uploadedDeals, hint: "Needs your churn over time" }
      : { label: "Deal-aware answers", on: Boolean(dealNote.trim()) || Boolean(consumerNote.trim()) || metricsSaved || uploadedDeals, hint: "Needs a deal you won or lost, or your churn" },
  ];

  function updateCompetitor(index: number, field: keyof CompetitorInput, value: string) {
    setCompetitors((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }
  function addCompetitor() {
    setCompetitors((prev) => [...prev, { name: "", domain: "" }]);
  }
  function removeCompetitor(index: number) {
    setCompetitors((prev) => prev.filter((_, i) => i !== index));
  }

  // Saves the business context and competitors as soon as the competitors step is
  // done, before the assistant is connected, so the first crawl is already running
  // when the first question is asked. The server skips this if they're already saved.
  async function saveCore(): Promise<boolean> {
    const res = await fetch("/api/connect/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: "core",
        positioning,
        icp,
        competitors: filledCompetitors,
        liveReadId: intro?.readId ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      return false;
    }
    // Saved now: list them and leave a single empty row for anything added after going Back.
    if (filledCompetitors.length > 0) {
      setSavedList((prev) => [...prev, ...filledCompetitors]);
      setCompetitors([{ name: "", domain: "" }]);
    }
    return true;
  }

  // Ends setup: saves the optional deal note and marks the wizard done. With
  // after="slack" it then leaves for Slack's sign-in instead of celebrating, since
  // that's a full page change and the setup would be lost if it hadn't been saved first.
  async function finish(after?: "slack") {
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/connect/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "extras", dealNote: noteToSave }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitting(false);
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }
    if (after === "slack") {
      window.location.assign(`/api/integrations/slack/connect?next=${encodeURIComponent("/app/settings?tab=data")}`);
      return;
    }
    // Stay on the finish screen: it holds the first read and the first questions, which take
    // longer than a few seconds to take in. The next step is a button, not a timer.
    trackEvent("setup_completed");
    if (noteToSave.trim()) setDealResult(data.deal ?? { imported: 0, skipped: 0 });
    // Keep the read for the screen below; the saved copy has done its job.
    clearIntro();
    setCelebrating(true);
  }

  // Leaves deals and Slack for later: ends setup and goes to the Connect settings.
  async function skipRest() {
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/connect/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "extras" }),
    });
    if (!res.ok) {
      setSubmitting(false);
      setError("Something went wrong. Try again.");
      return;
    }
    trackEvent("setup_completed", { skipped_optional: true });
    clearIntro();
    router.push("/app/settings?tab=connect");
    router.refresh();
  }

  if (step === CONNECT_STEP) {
    return (
      <>
        <McpConnectStep
          mcpLastConnectedAt={mcpLastConnectedAt}
          connectedAssistants={connectedAssistants}
          stepNumber={step + 1}
          totalSteps={TOTAL_STEPS}
          firstQuestionCompetitor={leadCompetitor}
          onContinue={() => {
            setJustUnlocked(ONBOARDING_VALUE.connect.unlocked());
            setStep(CONNECT_STEP + 1);
          }}
          onSkip={() => void skipRest()}
          skipping={submitting}
          onBack={() => {
            setJustUnlocked(null);
            setError("");
            setStep(1);
          }}
        />
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </>
    );
  }

  if (celebrating) {
    const lead = leadCompetitor;
    return (
      <>
        <Confetti />
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold tracking-tight">You&apos;re all set, {companyName}.</h1>
            <p className="text-sm text-muted-foreground">
              {allCompetitorNames.length > 0
                ? `I'm checking ${allCompetitorNames.length} competitor${allCompetitorNames.length === 1 ? "" : "s"} now.`
                : "I'm checking your competitors now."}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {dealResult ? (
              <p className="flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                {dealResult.imported > 0
                  ? `Logged ${dealResult.imported} deal${dealResult.imported === 1 ? "" : "s"} from what you told me. Answers will weigh it from now on.`
                  : "I couldn't turn that into a deal. Tell your assistant how it went and it will log it properly."}
              </p>
            ) : null}
            {intro?.read && intro.competitor ? (
              <PersonalReadCard competitorName={intro.competitor.name} read={intro.read} evidence={intro.evidence} />
            ) : (
              <MomentumBoardLive names={allCompetitorNames} />
            )}
            <FirstQuestions competitor={lead} assistants={connectedAssistants} />
            <QuickGuide />
<DealsImportCard assistants={connectedAssistants} settingsHref="/app/settings?tab=data" />
          </CardContent>
        </Card>
      </>
    );
  }

  const wizardStep = wizardIndex(step);
  const { title, optional, key } = WIZARD_STEPS[wizardStep];

  // Competitors are saved before connecting, so a first question has something to read.
  async function advance() {
    if (wizardStep === 1) {
      setSubmitting(true);
      setError("");
      const saved = await saveCore();
      setSubmitting(false);
      if (!saved) return;
      setJustUnlocked(ONBOARDING_VALUE.competitors.unlocked(allCompetitorNames.length || filledCompetitors.length));
      setStep(CONNECT_STEP);
      return;
    }
    // Only celebrate what actually happened: a blank business step unlocked nothing.
    if (wizardStep === 0) {
      setJustUnlocked(positioning.trim() || icp.trim() ? ONBOARDING_VALUE.business.unlocked() : null);
    } else if (wizardStep === 2) {
      setJustUnlocked(dealNote.trim() || consumerNote.trim() || uploadedDeals || metricsSaved ? ONBOARDING_VALUE.tools.unlocked() : null);
    }
    setStep((s) => s + 1);
  }

  return (
    <Card>
      <CardHeader>
        <ReadinessMeter percent={readiness} skills={skills} />
        {justUnlocked && wizardStep !== 3 ? (
          <p className="mb-1 flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {justUnlocked}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step {step + 1} of {TOTAL_STEPS}
            {optional ? " · optional" : ""}
          </p>
          {justUnlocked && wizardStep === 3 ? (
            <span className="flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="size-3.5" />
              Tools saved
            </span>
          ) : null}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{wizardStep === 2 ? copy.title : title}</h1>
        <p className="text-sm text-muted-foreground">
          {wizardStep === 0
            ? `This is what your assistant uses to judge whether something is actually relevant to ${companyName}, not just noise. Skip it and every answer defaults to generic.`
            : wizardStep === 1
              ? "Required. Your assistant can't compare you to anyone until it knows who to compare you to. Saving this starts your first check, so it's already running when you ask your first question."
              : wizardStep === 2
                ? copy.intro
                : "Slack is the shared feed: alerts and recaps land in a channel your whole team sees. Skip it if you're the only one using Ripplewatch."}
        </p>
        {wizardStep === 2 || wizardStep === 3 ? null : (
          <p className="mt-1 rounded-md bg-primary/[0.06] px-3 py-2 text-sm">
            <span className="font-semibold text-primary">Why this matters: </span>
            {ONBOARDING_VALUE[key].unlocks}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {wizardStep === 0 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="website">Company website</Label>
              <div className="flex gap-2">
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  onBlur={() => void lookupCompany()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void lookupCompany();
                    }
                  }}
                  placeholder="acme.com"
                  autoComplete="url"
                />
                <Button type="button" variant="outline" onClick={() => void lookupCompany()} disabled={overviewState === "reading" || !website.trim()}>
                  {overviewState === "reading" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Read my site
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                I&apos;ll read your homepage and pricing page to get your positioning and who you sell to right, then you can
                edit anything. Optional.
              </p>
              {overviewState === "failed" ? <p className="text-xs text-destructive">{overviewError}</p> : null}
            </div>
            {overview ? (
              <div className="rounded-md border border-primary/30 bg-primary/[0.04] p-4">
                <p className="text-sm font-semibold">Here&apos;s what I found</p>
                <p className="mt-1 text-sm">{overview}</p>
              </div>
            ) : null}
            <AudiencePicker
              value={sellsTo}
              onChange={(next) => {
                chooseSellsTo(next);
                setSellsToNote(null);
              }}
              note={sellsToNote}
            />
            <div className="space-y-2">
              <Label htmlFor="positioning">One-line positioning</Label>
              <Input
                id="positioning"
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                placeholder="Relevance-scored competitive intel for startup marketing teams"
              />
              {suggested?.positioning ? (
                <button type="button" className="text-left text-xs text-primary hover:underline" onClick={() => { setPositioning(suggested.positioning); setSuggested((cur) => (cur ? { ...cur, positioning: "" } : cur)); }}>
                  Use this from your site instead: {suggested.positioning}
                </button>
              ) : null}
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
              {suggested?.icp ? (
                <button type="button" className="text-left text-xs text-primary hover:underline" onClick={() => { setIcp(suggested.icp); setSuggested((cur) => (cur ? { ...cur, icp: "" } : cur)); }}>
                  Use this from your site instead: {suggested.icp}
                </button>
              ) : null}
            </div>
          </div>
        )}

        {wizardStep === 1 && (
          <div className="space-y-4">
            {savedList.length > 0 ? (
              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">Already saved and being watched</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {savedList.map((c) => (
                    <span key={c.name} className="rounded-full border border-border px-3 py-1 text-sm">
                      {c.name}
                      {c.domain ? <span className="text-muted-foreground"> · {c.domain}</span> : null}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Add more below if you like. To rename or remove one, use Settings, under Competitors.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              {competitors.map((c, i) => (
                <CompetitorRow
                  key={i}
                  value={c}
                  onChange={(field, val) => updateCompetitor(i, field, val)}
                  onRemove={() => removeCompetitor(i)}
                  removeDisabled={competitors.length <= (savedList.length > 0 ? 1 : 3)}
                  domainOnly
                />
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCompetitor}>
              <Plus className="size-4" />
              Add competitor
            </Button>
            <SuggestedCompetitors
              suggestions={suggestions}
              loading={suggestions === null}
              selectedNames={selectedNames}
              onToggle={toggleSuggestion}
            />
            <MomentumTease names={allCompetitorNames} domainByName={domainByName} />
          </div>
        )}

        {wizardStep === 2 ? (
          <SetupDataStep
            audience={sellsTo}
            onAudience={chooseSellsTo}
            competitorNames={allCompetitorNames}
            dealNote={dealNote}
            onDealNote={setDealNote}
            assistants={connectedAssistants}
            onConsumerNote={setConsumerNote}
            onDealsArrived={markDeals}
            onMetricsArrived={markMetrics}
          />
        ) : null}

        {wizardStep === 3 ? <SlackStep onConnect={() => void finish("slack")} busy={submitting} /> : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <div className="mt-6 flex items-center justify-between">
          <Button type="button" variant="ghost" className={step === 0 ? "invisible" : undefined} onClick={() => {
              setJustUnlocked(null);
              setStep((s) => Math.max(0, s - 1));
            }}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {wizardStep < WIZARD_STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => void advance()}
              disabled={(wizardStep === 1 && !hasCompetitor) || submitting}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {wizardStep === 1 ? (savedList.length > 0 && filledCompetitors.length === 0 ? "Continue" : "Save and connect") : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => void finish()} disabled={submitting}>
                Skip
              </Button>
              <Button type="button" onClick={() => void finish("slack")} disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Finish with Slack
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
