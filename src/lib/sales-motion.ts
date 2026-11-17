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
// what the step said before there was a choice.
export type DataCopy = {
  title: string;
  intro: string;
  unlocks: string;
  noteLabel: string;
  notePlaceholder: (competitor: string) => string;
  noteHelp: string;
  uploadLabel: string;
  uploadButton: string;
  uploadHelp: string;
  toolsHelp: string;
};

// One side's wording, for the tabs a company that sells to both sees.
export function sideCopy(side: "business" | "consumer"): DataCopy {
  return dataCopy(side);
}

export function dataCopy(audience: Audience | null): DataCopy {
  if (audience === "consumer") {
    return {
      title: "Add your churn and growth",
      intro:
        "Most consumer companies can't say why each customer left, but they know their churn. Give me your churn over time and I'll show you whether it's rising and which competitor moves line up with it.",
      unlocks:
        "Paste or upload churn over time, in any layout, or have your assistant pull it from your billing tool. I'll tell you whether churn is rising, how fast you're growing, and which competitor moves landed around the change. It shows when, not why, and I'll say how many months it rests on.",
      noteLabel: "Tell me what customers are saying, in your own words",
      notePlaceholder: (c) => `Three people cancelled this week and said ${c} has no monthly fee.`,
      noteHelp:
        "Customers who left or joined, one or several, however you'd say it out loud. Even a few of these help me read the numbers. Skip it and add more later.",
      uploadLabel: "Have a list of cancelled customers?",
      uploadButton: "Upload customers (any CSV)",
      uploadHelp:
        "Any CSV of cancellations, refunds or churn survey answers, in any layout: I'll work out the columns and show you how I read them before anything is saved.",
      toolsHelp:
        "Once you're set up, your assistant can pull from these on a schedule, so new cancellations and feedback arrive without you. Don't see yours, or don't use any? That's fine: you can always just tell your assistant what a customer said.",
    };
  }
  if (audience === "both") {
    return {
      title: "Add your deals and your churn",
      intro:
        "Sales deals and consumer churn each make answers specific to you. Use the tabs to add either side, and skip the one that doesn't apply.",
      unlocks:
        "For your business side, upload won and lost deals from your CRM. For your consumer side, give me churn over time. I'll read each in its own terms: deals against the moves that cost you them, churn against when it started rising.",
      noteLabel: "Tell me about a deal or a customer, in your own words",
      notePlaceholder: (c) => `We lost a deal to ${c} on price. Separately, a few subscribers left for ${c} this month.`,
      noteHelp: "A won or lost deal, or customers who left, however you'd say it out loud. Skip it and add real data later.",
      uploadLabel: "Upload your deals or cancellations",
      uploadButton: "Upload deals or customers (any CSV)",
      uploadHelp:
        "Any CSV from your CRM or your consumer product, in any layout: I'll work out the columns and show you how I read them before anything is saved.",
      toolsHelp:
        "Once you're set up, your assistant can pull from these on a schedule, so new deals and cancellations arrive without you. Don't see yours, or don't use any? That's fine: you can always just tell your assistant how a deal or a customer went.",
    };
  }
  return {
    title: "Add your deals",
    intro:
      "Your deals are what make answers specific to you. Upload an export from your CRM, tell me about a deal, or, if they live in a tool your assistant can reach, have it pull them in for you.",
    unlocks:
      "Upload a won and lost export from your CRM, in any layout, and I'll read it. More history is better: I can see trends over time and which competitor moves lined up with your losses. Or tell me where your deals live and I'll give you the words to have your assistant pull them in.",
    noteLabel: "Tell me about a deal, in your own words",
    notePlaceholder: (c) => `We lost a deal to ${c}. They were cheaper and said setup was faster.`,
    noteHelp:
      "Won or lost, one deal or several, however you'd say it out loud. It makes your first answers about your deals, not just the market. Skip it and add real data later.",
    uploadLabel: "Upload your won and lost deals",
    uploadButton: "Upload deals (any CSV)",
    uploadHelp:
      "Any CSV from your CRM, in any layout: I'll work out the columns and show you how I read them before anything is saved. Go back as far as you have. More history lets me spot trends over time and see which competitor moves lined up with your losses.",
    toolsHelp:
      "Once you're set up, your assistant can pull from these on a schedule, so new deals arrive without you. Don't see yours, or don't use any? That's fine: you can always just tell your assistant how a deal went.",
  };
}
