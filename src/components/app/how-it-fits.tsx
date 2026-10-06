import { ArrowRight } from "lucide-react";

// One picture of how the pieces connect, since most of the confusion is about
// which thing does what. No hooks, so the marketing guide page can use it too.
const COLUMNS = [
  {
    title: "What goes in",
    lines: [
      "What you tell your assistant: your business, your deals, how they went.",
      "Deals your assistant pulls from tools you've connected to it, like HubSpot or Gong.",
    ],
  },
  {
    title: "What Ripplewatch does",
    lines: [
      "Checks your competitors every day for pricing, hiring, press and product changes.",
      "Scores each change against your positioning and your deals.",
    ],
  },
  {
    title: "Where it comes out",
    lines: [
      "Slack: the feed your whole team sees. Alerts, the weekly digest, the monthly recap.",
      "Your assistant: where you ask why it matters and what to do.",
      "Email: a backup to Slack, or an extra.",
    ],
  },
];

export function HowItFits() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-start">
        {COLUMNS.map((col, i) => (
          <div key={col.title} className="contents">
            <div>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {col.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
            {i < COLUMNS.length - 1 ? (
              <ArrowRight aria-hidden className="mt-1 hidden size-4 text-muted-foreground md:block" />
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-md bg-primary/[0.06] px-3 py-2 text-sm">
        Slack tells your team what changed. Your assistant helps you decide what to do about it.
      </p>
    </div>
  );
}
