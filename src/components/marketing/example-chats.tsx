"use client";

import { ArrowUp } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Two example conversations, one per audience. Both competitors are
// fictional: these illustrate the product, they are not claims about real
// companies.
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
];

export function ExampleChats() {
  return (
    <Tabs defaultValue="teams" className="mx-auto mt-10 max-w-2xl items-center gap-4">
      <TabsList>
        {CHATS.map((c) => (
          <TabsTrigger key={c.value} value={c.value}>
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
