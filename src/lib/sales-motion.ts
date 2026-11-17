// Who a customer sells to. A B2B team has deals in a CRM and calls on a
// recorder; a consumer company has cancellations, reviews and support tickets
// and no "deal" at all; plenty have both. The setup step and the Data tab word
// themselves to match. Kept in this browser only, like the tools picked beside
// it: it tailors wording and prompts, it isn't account data.
export type Audience = "business" | "consumer" | "both";

export const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: "business", label: "Businesses (B2B)", hint: "Sales deals, a CRM, call recordings" },
  { id: "consumer", label: "Consumers (B2C)", hint: "Sign-ups, cancellations, reviews, support" },
  { id: "both", label: "Both", hint: "A sales team and a consumer product" },
];

const STORAGE_KEY = "ripplewatch-audience";
const CHANGE_EVENT = "ripplewatch-audience-changed";

export function parseAudience(raw: string | null): Audience | null {
  return raw === "business" || raw === "consumer" || raw === "both" ? raw : null;
}

export function saveAudience(value: Audience): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage blocked: the step just keeps its default wording.
  }
}

// For useSyncExternalStore, so the server render is always the unset one.
export function subscribeAudience(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
export function audienceSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
export const audienceServerSnapshot = () => "";

// The words each audience sees on the "bring your data" step. Unset reads as
// business, which is what the step said before there was a choice.
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

export function dataCopy(audience: Audience | null): DataCopy {
  if (audience === "consumer") {
    return {
      title: "Add why customers choose or leave",
      intro:
        "What your customers say about why they signed up, stayed or left is what makes answers specific to you. Upload a cancellation or churn export, tell me what you're hearing, or have your assistant pull it from a tool it can reach.",
      unlocks:
        "Upload a cancellation or churn export, in any layout, and I'll read it. More history is better: I can see trends over time and which competitor moves lined up with the customers you lost. Or tell me where that feedback lives and I'll give you the words to have your assistant pull it in.",
      noteLabel: "Tell me what customers are saying, in your own words",
      notePlaceholder: (c) => `Three people cancelled this week and said ${c} has no monthly fee.`,
      noteHelp:
        "Customers who left or joined, one or several, however you'd say it out loud. It makes your first answers about your customers, not just the market. Skip it and add real data later.",
      uploadLabel: "Upload your cancellations or churn",
      uploadButton: "Upload customers (any CSV)",
      uploadHelp:
        "Any CSV of cancellations, refunds or churn survey answers, in any layout: I'll work out the columns and show you how I read them before anything is saved. Go back as far as you have. More history lets me spot trends over time and see which competitor moves lined up with your losses.",
      toolsHelp:
        "Once you're set up, your assistant can pull from these on a schedule, so new cancellations and feedback arrive without you. Don't see yours, or don't use any? That's fine: you can always just tell your assistant what a customer said.",
    };
  }
  if (audience === "both") {
    return {
      title: "Add your deals and customers",
      intro:
        "Sales deals and consumer cancellations both make answers specific to you. Upload an export, tell me about one, or have your assistant pull them from a tool it can reach.",
      unlocks:
        "Upload a won and lost export from your CRM, or a cancellation export from your consumer product, in any layout, and I'll read it. More history is better: I can see trends over time and which competitor moves lined up with your losses on each side. Or tell me where they live and I'll give you the words to have your assistant pull them in.",
      noteLabel: "Tell me about a deal or a customer, in your own words",
      notePlaceholder: (c) => `We lost a deal to ${c} on price. Separately, a few subscribers left for ${c} this month.`,
      noteHelp:
        "A won or lost deal, or customers who left or joined, however you'd say it out loud. Say which side it is, business or consumer, so it's clear when it's read back. Skip it and add real data later.",
      uploadLabel: "Upload your won and lost deals, or cancellations",
      uploadButton: "Upload deals or customers (any CSV)",
      uploadHelp:
        "Any CSV from your CRM or your consumer product, in any layout: I'll work out the columns and show you how I read them before anything is saved. Upload one file per side. More history lets me spot trends over time and see which competitor moves lined up with your losses.",
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
