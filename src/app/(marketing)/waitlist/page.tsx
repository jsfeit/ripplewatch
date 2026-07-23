import { Sparkles } from "lucide-react";
import { AlertCard } from "@/components/app/alert-card";
import { MOCK_SIGNALS, MOCK_COMPETITORS } from "@/lib/mock-data";
import { WaitlistForm } from "./waitlist-form";

const description =
  "Ripplewatch is onboarding teams in small batches to keep relevance scoring sharp. Join the waitlist to get early access.";

export const metadata = {
  title: "Join the waitlist",
  description,
  alternates: { canonical: "/waitlist" },
  openGraph: { title: "Join the waitlist — Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Join the waitlist — Ripplewatch", description, images: ["/opengraph-image"] },
};

const scoredExample = MOCK_SIGNALS.find((s) => s.id === "sig-1")!;
const exampleCompetitor = MOCK_COMPETITORS.find((c) => c.id === scoredExample.competitorId)!;

export default function WaitlistPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-16 px-6 py-24 lg:grid-cols-2 lg:items-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Join the waitlist</h1>
        <p className="mt-3 text-muted-foreground">
          We&apos;re onboarding a small batch of marketing teams first to keep relevance scoring
          sharp. Leave your email and we&apos;ll reach out.
        </p>
        <div className="mt-8">
          <WaitlistForm />
        </div>
      </div>

      <div className="hidden lg:block">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          What you&apos;ll get
        </p>
        <div className="mt-4">
          <AlertCard
            signal={scoredExample}
            competitorName={exampleCompetitor.name}
            competitorInitial={exampleCompetitor.initial}
          />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Every alert arrives scored against your own positioning, ICP, and lost-deal
          reasons — not just a list of what changed.
        </p>
      </div>
    </div>
  );
}
