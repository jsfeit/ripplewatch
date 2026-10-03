import "server-only";
import type { ConnectOnboardingEmail } from "@/lib/resend";
import type { FirstLook } from "@/lib/first-look";
import { ONBOARDING_VALUE } from "@/lib/onboarding-value";

export type OnboardingStage = "day2" | "day7";

type Input = {
  stage: OnboardingStage;
  companyName: string;
  connected: boolean;
  look: FirstLook;
};

// Picks what to say from where this customer actually is, so a day-2 email to
// someone who never connected reads nothing like one to someone with findings
// waiting. Each branch leads with the value of the one thing to do next.
export function buildOnboardingEmail({ stage, companyName, connected, look }: Input): ConnectOnboardingEmail {
  const hasCompetitors = look.competitors.length > 0;
  const hasFindings = look.topSignals.length > 0;
  // Deal history is what turns generic findings into answers about their own
  // market, so until some is in, every email that has competitors to talk about
  // points at the Data tab, where a deal can be typed, emailed or uploaded.
  const dealLink = look.hasDealHistory
    ? undefined
    : { label: "Add a deal you won or lost, email a list, or upload a file", path: "/app/settings?tab=data" };

  if (!connected) {
    return {
      subject: `${companyName}, your Ripplewatch isn't connected yet`,
      headline: "One step and I'm working for you",
      paragraphs: [
        ONBOARDING_VALUE.connect.unlocks,
        "It takes about two minutes: add the Ripplewatch connector in Claude or ChatGPT, sign in, and approve.",
      ],
      ctaLabel: "Connect your assistant",
      ctaPath: "/app/get-started",
    };
  }

  if (!hasCompetitors) {
    return {
      subject: `Who should I watch for ${companyName}?`,
      headline: "I'm connected, but I have nobody to watch yet",
      paragraphs: [
        ONBOARDING_VALUE.competitors.unlocks,
        "Tell your assistant the one competitor you lose deals to most, with their website. That's all I need to start.",
      ],
      tryAsking: look.starterPrompts,
      ctaLabel: "Open Settings",
      ctaPath: "/app/settings?tab=connect",
    };
  }

  if (stage === "day2") {
    return hasFindings
      ? {
          subject: `What I found on ${look.competitors[0]} so far`,
          headline: `Here's what I've found for ${companyName}`,
          paragraphs: [
            "These are the moves most worth your attention from the first check:",
            ...(dealLink ? ["I can tell you which of these actually threaten your deals once I know a few you've won or lost."] : []),
          ],
          findings: look.topSignals,
          tryAsking: look.starterPrompts.slice(0, 3),
          ctaLabel: "See your first look",
          ctaPath: "/app/settings?tab=connect",
          secondaryLink: dealLink,
        }
      : {
          subject: `Nothing big has moved at ${look.competitors[0]} yet`,
          headline: "Quiet so far, and that's useful to know",
          paragraphs: [
            `I checked ${look.competitors.length} competitor${look.competitors.length === 1 ? "" : "s"} and nothing major has changed. I'll tell you the moment something does.`,
            "In the meantime, the fastest way to make my answers sharper is to tell your assistant about a recent deal you won or lost.",
          ],
          tryAsking: look.starterPrompts.slice(0, 3),
          ctaLabel: dealLink ? "Add your deal history" : "Open Settings",
          ctaPath: dealLink ? dealLink.path : "/app/settings?tab=connect",
        };
  }

  const next = look.next.next;
  return {
    subject: `How's week one going, ${companyName}?`,
    headline: "A quick check-in",
    paragraphs: [
      hasFindings
        ? "Here's what has been worth your attention so far."
        : "It's been a quiet first week at the competitors you track.",
      ...(next ? [`${next.headline} ${next.payoff}`] : []),
    ],
    findings: hasFindings ? look.topSignals : undefined,
    tryAsking: look.starterPrompts.slice(0, 3),
    ctaLabel: dealLink ? "Add your deal history" : "Open Settings",
    ctaPath: dealLink ? dealLink.path : "/app/settings?tab=connect",
  };
}
