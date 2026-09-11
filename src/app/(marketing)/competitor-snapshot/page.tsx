import Link from "next/link";
import { CompetitorSnapshotTool } from "@/components/marketing/competitor-snapshot-tool";
import { DemoLink } from "@/components/marketing/demo-link";

const description =
  "Enter a competitor's domain and get a live, one-time snapshot of their pricing, right now. See what Ripplewatch would track continuously.";

export const metadata = {
  title: "Free Competitor Snapshot",
  description,
  alternates: { canonical: "/competitor-snapshot" },
  openGraph: { title: "Free Competitor Snapshot | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: {
    card: "summary_large_image",
    title: "Free Competitor Snapshot | Ripplewatch",
    description,
    images: ["/opengraph-image"],
  },
};

export default function CompetitorSnapshotPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">What would we catch about your competitor?</h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
        <div className="mt-4 flex justify-center">
          <DemoLink label="Rather see it live? Book a demo" />
        </div>
      </div>
      <div className="mt-12">
        <CompetitorSnapshotTool />
      </div>
      <p className="mt-10 text-center text-sm text-muted-foreground">
        Curious how mature your whole competitive intelligence process is, not just one competitor?{" "}
        <Link href="/competitive-intelligence-quiz" className="font-medium text-primary hover:underline">
          Take the 5-question quiz
        </Link>
        .
      </p>
    </div>
  );
}
