// Single source of truth for FAQ content — rendered on the page and used to
// build the FAQPage structured data, so the two can never drift apart.

export type FaqItem = { question: string; answer: string };
export type FaqCategory = { title: string; items: FaqItem[] };

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "Product",
    items: [
      {
        question: "What is Ripplewatch?",
        answer:
          "Not alerts. Not data. Answers. Ripplewatch is competitive intelligence built for early-stage SaaS founders, not PMM teams: it monitors the competitors you choose and scores every signal (a pricing change, a job posting, a news mention) against your own positioning, ICP, and the real reasons you've lost deals or churned customers, then rolls it all up into a single Momentum score per competitor.",
      },
      {
        question: "How is this different from other competitive intelligence tools?",
        answer:
          "Most tools tell you what changed and stop there, leaving you to figure out whether it matters. Ripplewatch scores every signal against your specific business context using a fixed, ordered rubric: the same signal can be High relevance for one company and Low for another, because it's judged against what actually affects that business, not a generic severity scale.",
      },
      {
        question: "What data sources does it monitor?",
        answer:
          "Pricing pages, job postings, news coverage, and funding announcements, continuously, for every competitor you track. If you connect Slack, HubSpot, Gong, or Zoom, it also draws on sales-call mentions and CRM deal notes to sharpen its judgment.",
      },
      {
        question: "Does it use my sales calls or CRM data?",
        answer:
          "Only if you connect Gong, Zoom, or HubSpot yourself, and only to add context to scoring, for example recognizing that a competitor's price cut matches a reason you've actually lost a deal. You can disconnect any integration at any time in Settings.",
      },
      {
        question: "What is the Ask feature?",
        answer:
          "A chat interface scoped to your own tracked competitors and business context. Instead of waiting for the next update, you can ask something like \"what has this competitor changed recently that matters to us?\" and get an answer grounded in your last 90 days of signals.",
      },
      {
        question: "What is Momentum?",
        answer:
          "A single directional score (Heating up, Steady, or Cooling) for each competitor, built from what we already track: hiring velocity, pricing activity, product and feature changes, press and funding coverage weighted by whether it's actually good or bad news for them, how our own relevance scoring is trending, and your win/loss record against them, plus GitHub commit activity if you're tracking an open-source competitor and add their repo. Each input carries more or less weight depending on how consistently we've actually had real data for that specific competitor, so one stale signal can't swing the score the way a well-populated one can. It's meant to answer \"is this competitor getting more or less dangerous\" at a glance, without you having to read six separate trend charts.",
      },
      {
        question: "How do I get win/loss data into Ripplewatch?",
        answer:
          'Whichever fits how your team already works: paste a CSV export or sync HubSpot deals from the dashboard\'s Win/loss section, push outcomes programmatically via <a href="/docs/api">POST /api/v1/win-loss</a> the moment a deal closes, or just forward or CC a "we lost this deal" email to your personal address shown in Settings → Developer (Plus/Advanced plans). All three feed the same pipeline, and update each competitor\'s Momentum win-rate trend immediately.',
      },
    ],
  },
  {
    title: "Pricing & billing",
    items: [
      {
        question: "Can I cancel anytime?",
        answer:
          "Yes. Cancel whenever you want from Settings; it takes effect at the end of your current billing period, and there's no penalty or lock-in. And if you're within 30 days of any charge, email us and we'll give you a full refund, no questions asked.",
      },
      {
        question: "Do you offer a free trial?",
        answer:
          "Not a traditional free trial. Instead, every plan comes with that 30-day money-back guarantee, so you can actually use Ripplewatch for real, against your real competitors, before deciding it's for you.",
      },
      {
        question: "Why don't you offer a free tier?",
        answer:
          "Because the value you're getting isn't a static dashboard, it's a live AI model reading and scoring every signal against your specific business context. Every pricing change, job posting, and news mention we surface has actually been analyzed by Claude in real time, not pulled from a cache and shown to everyone the same way. That analysis has a real, per-signal cost to us on every account, whether or not that account is paying. A free tier would mean covering that cost indefinitely for accounts that never convert, which isn't something we can sustain at our size. Instead we put that money into the 30-day guarantee, so you can use the real product risk-free without us subsidizing free usage forever.",
      },
      {
        question: "Do you offer annual billing?",
        answer: "Yes, on every plan: annual billing is 20% cheaper than paying monthly.",
      },
      {
        question: "Do you have a referral program?",
        answer:
          'Yes. Any paying customer can generate a shareable link from <a href="/app/settings#referrals">Settings → Referrals</a>. The company you refer gets 2 months free the moment they sign up, and you get 2 months free of your own once they\'ve been an active, paying customer for 60 days (not immediately, this keeps the reward tied to a referral that actually sticks, not a signup that cancels right away). Multiple successful referrals stack. See our <a href="/terms#referral-program">Terms of Service</a> for the full details.',
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
      {
        question: "How is my data encrypted?",
        answer:
          "Everything is encrypted in transit over HTTPS/TLS, and encrypted at rest in our database using our provider's standard AES-256 encryption. We never store your payment card details ourselves; Stripe handles all card processing directly on their own PCI-compliant infrastructure.",
      },
    ],
  },
  {
    title: "Getting started",
    items: [
      {
        question: "How do I get started?",
        answer:
          "Sign up, then walk through a short onboarding flow: tell us your positioning, your ICP, and the competitors you want tracked. From there, scored updates start showing up as soon as the first crawl runs.",
      },
      {
        question: "What integrations do you support?",
        answer: "Slack for delivery, and HubSpot, Gong, and Zoom for extra context on scoring.",
      },
      {
        question: "How do I contact support, and how fast do you respond?",
        answer: "Email hello@ripplewatch.ai; we respond within 3 days.",
      },
      {
        question: "Where can I read more about the competitive intelligence market?",
        answer:
          'We put together a full survey of the CI landscape, how 14 different tools approach monitoring, what they cover, and where the gaps are, in our <a href="/state-of-competitive-intelligence">State of Competitive Intelligence</a> report.',
      },
    ],
  },
];
