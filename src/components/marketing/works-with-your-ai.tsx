import { Link2, MessagesSquare, PlugZap } from "lucide-react";
import { Panel } from "@/components/ui/panel";

const POINTS = [
  {
    icon: MessagesSquare,
    title: "Lives where you already work",
    body: "Claude, ChatGPT or any assistant that supports remote MCP. Ask in the chat you already have open. No new tab, no new login, no dashboard to remember.",
  },
  {
    icon: Link2,
    title: "Everything in one place",
    body: "Pricing, hiring, press, funding and product changes, plus your own win/loss and call notes, pulled into one conversation and scored against your positioning.",
  },
  {
    icon: PlugZap,
    title: "Connected in a couple of minutes",
    body: "Paste one connector URL into your assistant, sign in, and ask your first question.",
  },
];

export function WorksWithYourAI() {
  return (
    <section className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Nothing new to open. Just the AI you already pay for.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Competitive intel usually means another tool to check. Ripplewatch brings it to the assistant your team
            already talks to all day.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {POINTS.map((p) => (
            <Panel key={p.title} className="p-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <p.icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-medium">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </Panel>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-xl text-center">
          <code className="inline-block max-w-full overflow-x-auto rounded-md border border-border bg-card px-3 py-1.5 text-xs">
            https://www.ripplewatch.ai/api/mcp
          </code>
          <p className="mt-3 text-xs text-muted-foreground">
            The connector URL. ChatGPT connects through its developer mode, which is in beta.
          </p>
        </div>
      </div>
    </section>
  );
}
