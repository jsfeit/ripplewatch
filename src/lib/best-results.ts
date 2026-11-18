// "For the best results": the few habits that make Ripplewatch noticeably better, written once. The finish screen,
// the Settings Connect tab, the guide page and the assistant's how_to_use tool all read this, and the welcome email
// links to it, so a customer hears the same thing everywhere.
//
// Every line has to be true of the product today. If one stops being true (the Claude menu path, the permission
// wording, the Momentum timing), change it here and it changes everywhere.
export type BestResult = { id: string; title: string; body: string };

export const BEST_RESULTS: BestResult[] = [
  {
    id: "using",
    title: "Start with “Using Ripplewatch:”",
    body: "Put it at the start of a question and your assistant reads your live competitor data. Without it, the assistant may answer from general knowledge instead.",
  },
  {
    id: "allow",
    title: "Allow Ripplewatch's tools",
    body: "When your assistant asks permission to use Ripplewatch, choose Always allow, so a question doesn't stall waiting for a click.",
  },
  {
    id: "tell",
    title: "Tell it how deals go",
    body: "Say it in plain words or attach a file: the deals you won and lost, or your churn if you sell to consumers. That is what turns general competitor news into what is actually costing you.",
  },
  {
    id: "menu",
    title: "Use the Ripplewatch menu in Claude",
    body: "Click +, then Plugins, then Ripplewatch for ready-made prompts like the weekly briefing. Connected a while ago and the list looks short? Remove and re-add the connector once to refresh it.",
  },
  {
    id: "momentum",
    title: "Give Momentum a month",
    body: "Momentum compares the last 30 days with the 30 before, so the first score takes about a month. Until then your assistant tells you what the first check found.",
  },
  {
    id: "reload",
    title: "Keep auto-reload on",
    body: "Answers and monitoring pause when your balance reaches zero. Auto-reload tops it up from your saved card so that doesn't happen.",
  },
];
