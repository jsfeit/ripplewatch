// Who a customer sells to. A B2B team has deals in a CRM and calls on a recorder; a consumer
// company has cancellations, churn and reviews and no "deal" at all; plenty have both. The setup
// step and the Data tab word themselves to match. The answer is saved on the account
// (accounts.sells_to), so the assistant and the relevance scoring see it too.
export type Audience = "business" | "consumer" | "both";

export const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: "business", label: "B2B", hint: "You sell to companies: deals, a CRM, calls" },
  { id: "consumer", label: "B2C", hint: "You sell to people: sign-ups, cancellations, reviews" },
  { id: "both", label: "Both", hint: "A sales team and a consumer product" },
];

export function parseAudience(raw: unknown): Audience | null {
  return raw === "business" || raw === "consumer" || raw === "both" ? raw : null;
}

// The words each audience sees on the "bring your data" step. Unset reads as business, which is
// what the step said before there was a choice. Kept short on purpose: this step is optional.
export type DataCopy = {
  title: string;
  intro: string;
  noteLabel: string;
  notePlaceholder: (competitor: string) => string;
  noteHelp: string;
};

export function dataCopy(audience: Audience | null): DataCopy {
  if (audience === "consumer") {
    return {
      title: "Add your churn",
      intro: "Tell me about your churn, or paste your numbers. I'll show whether it's rising and which competitor moves line up with it.",
      noteLabel: "Your churn, in your own words or as a table",
      notePlaceholder: () => "Churn was 4.8% in September and 6.2% in October.\nOr paste a table from your billing tool, any layout.",
      noteHelp: "Include the months. A few is enough, and more makes the read more reliable.",
    };
  }
  if (audience === "both") {
    return {
      title: "Add your deals and your churn",
      intro: "Use the tabs to add either side. Skip the one that doesn't apply.",
      noteLabel: "",
      notePlaceholder: () => "",
      noteHelp: "",
    };
  }
  return {
    title: "Add your deals",
    intro: "Tell me about a deal you won or lost, or upload a list. It makes your first answers about your deals, not just the market.",
    noteLabel: "A deal, or a list of them, in your own words",
    notePlaceholder: (c) => `We lost a deal to ${c}. They were cheaper and said setup was faster.`,
    noteHelp: "Won or lost, one or several, however you'd say it. More history makes answers sharper.",
  };
}
