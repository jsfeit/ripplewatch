import Link from "next/link";
import { ArrowRight, Check, MessageSquare, PlugZap, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CONNECT_EXAMPLES, CONNECT_FEATURES, CONNECT_NAME, CONNECT_TAGLINE } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD, CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";

const description =
  "Ripplewatch Connect brings competitive intelligence into Claude and ChatGPT. Ask what changed, get the read on what it means for your deals, and log outcomes by just telling your assistant. $29 a month plus usage you prepay for.";

export const metadata = {
  title: `${CONNECT_NAME}: Ripplewatch inside Claude and ChatGPT`,
  description,
  alternates: { canonical: "/connect" },
  openGraph: { title: `${CONNECT_NAME} | Ripplewatch`, description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: `${CONNECT_NAME} | Ripplewatch`, description, images: ["/opengraph-image"] },
};

const STEPS = [
  {
    icon: PlugZap,
    title: "Add Ripplewatch to your assistant",
    body: "Paste one URL as a custom connector in Claude or ChatGPT, then sign in and approve. No API key, no setup call.",
  },
  {
    icon: MessageSquare,
    title: "Ask, the way you already work",
    body: "Ask what changed, whether a competitor's move matters to you, or tell it how a deal went. It answers from your competitors and your positioning.",
  },
  {
    icon: Sparkles,
    title: "It gets sharper as you use it",
    body: "Every answer ends with the one thing you could share that would make the next one better, like the deals you lost to a competitor that just moved.",
  },
];

const GET_STARTED = "/onboarding?path=connect";

export default function ConnectPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3.5" />
          New
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Ripplewatch, inside the assistant you already use</h1>
        <p className="mt-4 text-muted-foreground">
          {CONNECT_TAGLINE} Ask what your competitors did this week, what it means for your deals, and tell it how deals
          went, all in the chat.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href={GET_STARTED} className={buttonVariants({ size: "lg" })}>
            Get {CONNECT_NAME} <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">${CONNECT_BASE_FEE_USD}/month plus usage you prepay for.</p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.title} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <step.icon className="size-5" />
            </div>
            <h2 className="mt-4 text-base font-medium">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">What you can ask</h2>
          <ul className="mt-5 space-y-3">
            {CONNECT_EXAMPLES.map((q) => (
              <li key={q} className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-2.5 text-sm">
            {CONNECT_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            You approve every connection and can disconnect any time. It can read your competitive intel and log deals
            and feedback you tell it about. It can&apos;t touch billing or team settings.
          </p>
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wallet className="size-5 text-primary" />
            Simple pricing
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="font-medium">${CONNECT_BASE_FEE_USD} a month, platform fee</dt>
              <dd className="mt-1 text-muted-foreground">
                Unlimited teammates, the assistant connector and support. Refundable within 30 days.
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="font-medium">Usage comes from a balance you prepay</dt>
              <dd className="mt-1 text-muted-foreground">
                Each answer and each competitor you watch draws from your balance at our actual AI cost plus a small
                margin. Typically a few cents an answer and a dollar or two a month per competitor. Start with $
                {CONNECT_MIN_FUNDING_USD} or more.
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="font-medium">You can never run up a bill</dt>
              <dd className="mt-1 text-muted-foreground">
                When the balance hits zero, answers and monitoring pause until you add funds. Each answer shows what it
                cost. Balance already used isn&apos;t refundable.
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <Link href={GET_STARTED} className={buttonVariants({ className: "w-full" })}>
              Get {CONNECT_NAME} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-2xl rounded-xl border border-border bg-secondary/40 p-8 text-center">
        <h3 className="text-lg font-semibold">Prefer a dashboard?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          The Ripplewatch dashboard is a separate product with fixed monthly pricing and no usage bill.
        </p>
        <div className="mt-5 flex justify-center">
          <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
            See dashboard plans <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
