// One place for what each onboarding step is worth to the customer, so the
// wizard, the Settings checklist and the emails all say the same thing.
// `unlocks` is shown before someone does the step (why bother), `unlocked`
// right after (what just got better). Written in the assistant's voice.
export type OnboardingStepKey = "connect" | "business" | "competitors" | "slack";

export const ONBOARDING_VALUE: Record<OnboardingStepKey, { unlocks: string; unlocked: (n?: number) => string }> = {
  connect: {
    unlocks: "Once I'm connected, your assistant can brief you on your competitors, answer questions about them, and log what you tell it.",
    unlocked: () => "Connected. Your assistant can now brief you and answer questions about your competitors.",
  },
  business: {
    unlocks: "I judge every competitor move against what you sell and who you sell to, so you hear about what matters and skip the noise.",
    unlocked: () => "Got it. From now on I score every move against how you position yourself.",
  },
  competitors: {
    unlocks: "The moment you add one, I start checking their pricing, hiring, product changes and press. First findings usually land within minutes.",
    unlocked: (n = 1) =>
      `Watching ${n} competitor${n === 1 ? "" : "s"} now. First findings usually land within a few minutes.`,
  },
  slack: {
    unlocks: "A short weekly digest lands in the channel you pick, so you don't have to remember to ask.",
    unlocked: () => "Slack is connected. Your digest arrives weekly.",
  },
};
