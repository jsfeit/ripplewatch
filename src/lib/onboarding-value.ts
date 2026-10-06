// One place for what each onboarding step is worth to the customer, so the
// wizard, the Settings checklist and the emails all say the same thing.
// `unlocks` is shown before someone does the step (why bother), `unlocked`
// right after (what just got better). Written in the assistant's voice.
export type OnboardingStepKey = "connect" | "business" | "competitors" | "tools" | "dealHistory" | "slack";

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
  tools: {
    unlocks: "Tell me where your deals and calls live and I'll give you the exact words to have your assistant pull them in, so you don't have to type them up.",
    unlocked: () => "Got it. I'll tailor the prompts to your tools.",
  },
  dealHistory: {
    unlocks: "Even one deal tells me which competitor moves actually cost you business, so my answers stop being general.",
    unlocked: () => "Deal history is in. I can now tie competitor moves to your real wins and losses.",
  },
  slack: {
    unlocks: "Alerts and recaps land in a channel your whole team sees, so nobody has to remember to ask.",
    unlocked: () => "Slack is connected. Alerts, the weekly digest and the monthly recap now post to your channel.",
  },
};
