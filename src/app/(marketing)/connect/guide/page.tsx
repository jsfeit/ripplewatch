import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GUIDE_TOPICS } from "@/lib/connect-guide";
import { HowItFits } from "@/components/app/how-it-fits";
import { CONNECT_NAME } from "@/lib/connect";

const description =
  "How to get the most out of Ripplewatch Connect: getting your win/loss data in, what momentum means, which emails you'll receive, how to see what changed, and what to ask your assistant.";

export const metadata = {
  title: "How to use Ripplewatch: win/loss data, momentum and what to ask",
  description,
  alternates: { canonical: "/connect/guide" },
  openGraph: { title: "How to use Ripplewatch | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "How to use Ripplewatch | Ripplewatch", description, images: ["/opengraph-image"] },
};

const SOLO = [
  "Connect your assistant (see the setup guide).",
  "Add the competitors you actually lose deals to.",
  "Tell it how three recent deals went, in the customer's words.",
  "Ask what changed, and read the Monday email.",
];
const TEAM = [
  "Connect one assistant and add the competitors.",
  "Invite teammates under Settings. Everyone shares the same competitors and deals.",
  "Connect Slack so alerts and recaps land in a shared channel.",
  "Agree who logs deals, and ask from your own assistants.",
];

export default function ConnectGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">How to get the most out of {CONNECT_NAME}</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Ripplewatch works inside your AI assistant, so most of this is knowing what to say. Start with the path that
        fits how you work, then jump to whatever you&apos;re stuck on.
      </p>

      <div className="mt-8">
        <HowItFits />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          { title: "Just you", steps: SOLO },
          { title: "With a team", steps: TEAM },
        ].map((path) => (
          <div key={path.title} className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">{path.title}</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {path.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <nav aria-label="Topics" className="mt-10">
        <ul className="flex flex-wrap gap-2">
          {GUIDE_TOPICS.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="rounded-full border border-border px-3 py-1 text-sm hover:border-primary/50">
                {t.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {GUIDE_TOPICS.map((topic) => (
        <section key={topic.id} id={topic.id} className="mt-14 scroll-mt-24">
          <h2 className="text-xl font-semibold tracking-tight">{topic.title}</h2>
          <div className="mt-3 space-y-4 leading-relaxed text-muted-foreground">
            {topic.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {topic.prompts?.length ? (
            <div className="mt-5">
              <p className="text-sm font-medium">Try saying</p>
              <ul className="mt-2 space-y-2">
                {topic.prompts.map((p) => (
                  <li key={p} className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
                    &ldquo;{p}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      <p className="mt-14 text-sm text-muted-foreground">
        You can also ask your assistant to explain any of this: say &ldquo;How do I get the most out of Ripplewatch?&rdquo;
        and it will walk you through it.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/onboarding?path=connect" className={buttonVariants({ size: "lg" })}>
          Get {CONNECT_NAME}
          <ArrowRight className="size-4" />
        </Link>
        <Link href="/connect/claude-and-chatgpt" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Connect your assistant
        </Link>
      </div>
    </div>
  );
}
