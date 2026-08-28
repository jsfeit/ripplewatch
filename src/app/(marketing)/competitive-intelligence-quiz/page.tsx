import { CompetitiveIntelQuiz, TIERS } from "@/components/marketing/competitive-intel-quiz";
import { DemoLink } from "@/components/marketing/demo-link";

const description =
  "Answer 5 quick questions to find out whether your competitive intelligence is Reactive, Aware, Systematic, or Predictive, and what to do about it.";

export const metadata = {
  title: "Competitive Intelligence Maturity Quiz",
  description,
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
        <div className="mt-4 flex justify-center">
          <DemoLink label="Rather walk through it live? Book a demo" />
        </div>
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
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{tier.nextStep}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
