// Single source of truth for FAQ content — rendered on the page and used to
// build the FAQPage structured data, so the two can never drift apart.

export type FaqItem = { question: string; answer: string };
export type FaqCategory = { title: string; items: FaqItem[] };

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "Pricing & billing",
    items: [
      {
        question: "Can I cancel anytime?",
        answer:
          "Yes. Cancel whenever you want from Settings — it takes effect at the end of your current billing period, and there's no penalty or lock-in. And if you're within 30 days of any charge, email us and we'll give you a full refund, no questions asked.",
      },
      {
        question: "Do you offer a free trial?",
        answer:
          "Not a traditional free trial — instead, every plan comes with that 30-day money-back guarantee, so you can actually use Ripplewatch for real, against your real competitors, before deciding it's for you.",
      },
      {
        question: "Do you offer annual billing?",
        answer: "Yes, on every plan — annual billing is 20% cheaper than paying monthly.",
      },
      {
        question: "What happens if I add more competitors than my plan allows?",
        answer:
          "You can add as many as you like, but only up to your plan's limit stay actively monitored (the earliest ones you added). The rest are visible but paused until you upgrade or remove one to make room.",
      },
      {
        question: "Is there a setup fee?",
        answer: "No. You only pay the plan price shown on the pricing page.",
      },
    ],
  },
  {
    title: "Product",
    items: [
      {
        question: "What is Ripplewatch?",
        answer:
          "An AI-native competitive intelligence tool for startup marketing and product teams. It monitors the competitors you choose and scores every signal — a pricing change, a job posting, a news mention — against your own positioning, ICP, and the real reasons you've lost deals or churned customers.",
      },
      {
        question: "How is this different from other competitive intelligence tools?",
        answer:
          "Most tools tell you what changed and stop there, leaving you to figure out whether it matters. Ripplewatch scores every signal against your specific business context using a fixed, ordered rubric — the same signal can be High relevance for one company and Low for another, because it's judged against what actually affects that business, not a generic severity scale.",
      },
      {
        question: "What data sources does it monitor?",
        answer:
          "Pricing pages, job postings, news coverage, and funding announcements, continuously, for every competitor you track. If you connect Slack, HubSpot, Gong, or Zoom, it also draws on sales-call mentions and CRM deal notes to sharpen its judgment.",
      },
      {
        question: "Does it use my sales calls or CRM data?",
        answer:
          "Only if you connect Gong, Zoom, or HubSpot yourself, and only to add context to scoring — for example, recognizing that a competitor's price cut matches a reason you've actually lost a deal. You can disconnect any integration at any time in Settings.",
      },
      {
        question: "What is the Ask feature?",
        answer:
          "A chat interface scoped to your own tracked competitors and business context. Instead of waiting for an alert, you can ask something like \"what has this competitor changed recently that matters to us?\" and get an answer grounded in your last 90 days of signals.",
      },
    ],
  },
  {
    title: "Data & security",
    items: [
      {
        question: "Do you sell my data?",
        answer: "No. We don't sell your personal or business information to anyone, for any reason.",
      },
      {
        question: "Is my data used to train AI models?",
        answer:
          "No. Relevant parts of your business context are sent to Anthropic's Claude models to generate your relevance scores and answers, but that data isn't used to train Anthropic's models or ours beyond producing your own results.",
      },
      {
        question: "How is my data kept separate from other customers?",
        answer:
          "Every account's data is isolated at the database level, so one customer's competitors, signals, and business context are never visible to another.",
      },
      {
        question: "What happens to my data if I cancel?",
        answer:
          "We keep it for a limited period in case you reactivate, and delete it sooner if you ask us to.",
      },
    ],
  },
  {
    title: "Getting started",
    items: [
      {
        question: "How do I get started?",
        answer:
          "Sign up, then walk through a short onboarding flow: tell us your positioning, your ICP, and the competitors you want tracked. From there, alerts start showing up as soon as the first crawl runs.",
      },
      {
        question: "What integrations do you support?",
        answer: "Slack for alert delivery, and HubSpot, Gong, and Zoom for extra context on scoring.",
      },
      {
        question: "How do I contact support, and how fast do you respond?",
        answer: "Email hello@ripplewatch.ai — we respond within 3 days.",
      },
    ],
  },
];
