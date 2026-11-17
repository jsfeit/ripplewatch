"use client";

import { ArrowUp } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Three example conversations, one per audience. Every company and competitor
// is fictional: these illustrate the product, they are not claims about real
// companies. The consumer one leads with Momentum, then the churn timing, then
// says plainly that it is a lead and not proof, which is how the product words it.
const CHATS = [
  {
    value: "teams",
    label: "Product marketing and sales",
    question: "What has Northlane changed recently that actually matters to us?",
    answer:
      "Two things worth acting on. They cut their entry tier from $99 to $69/mo, which directly narrows the price gap you've lost two deals to this month. They also removed the competitor-count cap on their top tier, which undercuts the \"scales with you\" pitch you lead with in upmarket conversations.",
    placeholder: "Ask about a competitor, a trend, or what's changed…",
  },
  {
    value: "founders",
    label: "Founders",
    question: "I'm about to raise prices. Is anyone I compete with already cheaper, or about to be?",
    answer:
      "Brightwell is the one to watch. They dropped their starter plan to $39/mo last week and are hiring two sales reps. You lost one deal to them this quarter, so hold the increase for new customers for now and lead with onboarding speed, which you told me is what wins.",
    placeholder: "Ask before you change pricing, positioning or roadmap…",
  },
  {
    value: "consumer",
    label: "Consumer apps",
    question: "Churn at Brightly has crept up since August. Is Plateful part of it?",
    answer:
      "Plateful is Heating up (+34). Their pricing page changed on August 8, and your churn started rising that same month, from about 4% to about 6%. That's timing, not proof, and it rests on three months of numbers, so treat it as a lead. People who cancel rarely say where they went. A two-question cancellation survey that asks whether they also use Plateful would tell you. Want me to draft it?",
    placeholder: "Ask about churn, a competitor, or what's changed…",
  },
];

export function ExampleChats() {
  return (
    <Tabs defaultValue="teams" className="mx-auto mt-10 max-w-2xl items-center gap-4">
      {/* Wraps onto two lines on a phone, where three tabs are wider than the screen. The shared tab bar
          has a fixed height and sizes its tabs as a percentage of it, so both are set explicitly here. */}
      <TabsList className="h-auto max-w-full flex-wrap justify-center gap-1 group-data-horizontal/tabs:h-auto">
        {CHATS.map((c) => (
          <TabsTrigger key={c.value} value={c.value} className="h-7 flex-none px-3">
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {CHATS.map((c) => (
        <TabsContent key={c.value} value={c.value} className="w-full">
          <Panel className="p-5 shadow-sm">
            <div className="ml-auto max-w-[85%] rounded-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
              {c.question}
            </div>
            <div className="mr-auto mt-4 max-w-[85%] rounded-lg border border-primary/20 bg-accent/60 px-4 py-3 text-sm leading-relaxed text-foreground">
              {c.answer}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
              {c.placeholder}
              <ArrowUp className="ml-auto size-3.5 shrink-0 rounded-full bg-primary p-0.5 text-primary-foreground" />
            </div>
          </Panel>
        </TabsContent>
      ))}
    </Tabs>
  );
}
