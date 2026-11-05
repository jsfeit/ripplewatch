import Link from "next/link";
import { fitTitle } from "@/lib/seo";
import { CompetitiveIntelQuiz } from "@/components/marketing/competitive-intel-quiz";
import { TIERS } from "@/lib/quiz-tiers";

const description =
  "A free, 2-minute competitive intelligence questionnaire: 5 questions to find out if yours is Reactive, Aware, Systematic or Predictive, and what to do next.";

// Search snippet copy. The page's intro paragraph keeps the `description` above.
const metaDescription =
  "Answer 5 questions to see if your competitive intelligence is Reactive, Aware, Systematic or Predictive, and get your next steps. Free, takes 2 minutes.";

export const metadata = {
  title: fitTitle("Free Competitive Intelligence Questionnaire (2 Minutes)"),
  description: metaDescription,
  alternates: { canonical: "/competitive-intelligence-quiz" },
  openGraph: { title: "Competitive Intelligence Maturity Quiz | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: {
    card: "summary_large_image",
    title: "Competitive Intelligence Maturity Quiz | Ripplewatch",
    description,
    images: ["/opengraph-image"],
  },
};

export default function CompetitiveIntelligenceQuizPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">How mature is your competitive intelligence?</h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
      </div>
      <div className="mt-12">
        <CompetitiveIntelQuiz />
      </div>

      <div className="mt-20 border-t border-border pt-12">
        <h2 className="text-lg font-medium">The four maturity levels</h2>
        <dl className="mt-6 space-y-8">
          {TIERS.map((tier) => (
            <div key={tier.name}>
              <dt className="font-medium text-foreground">{tier.name}</dt>
              <dd className="mt-1 leading-relaxed text-muted-foreground">{tier.summary}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-10 text-center text-sm text-muted-foreground">
        Want proof, not a self-assessment?{" "}
        <Link href="/competitor-snapshot" className="font-medium text-primary hover:underline">
          Get a live snapshot of one real competitor
        </Link>
        .
      </p>
    </div>
  );
}
