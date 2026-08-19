import { CompetitiveIntelQuiz } from "@/components/marketing/competitive-intel-quiz";

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
      </div>
      <div className="mt-12">
        <CompetitiveIntelQuiz />
      </div>
    </div>
  );
}
