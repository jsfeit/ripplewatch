import Link from "next/link";
import { fitTitle } from "@/lib/seo";
import { COMPARISONS } from "@/lib/comparisons";

const description =
  "Crayon, Klue, Kompyte, AlphaSense and Ripplewatch compared: monitoring, scoring and cost. Ripplewatch is an AI analyst inside Claude and ChatGPT.";

export const metadata = {
  title: fitTitle("Crayon vs Klue vs Kompyte vs Ripplewatch: compared"),
  description,
  alternates: { canonical: "/compare" },
  openGraph: { title: "Crayon vs Klue vs Kompyte vs Ripplewatch: compared", description, images: ["/opengraph-image"] },
  twitter: {
    card: "summary_large_image",
    title: "Crayon vs Klue vs Kompyte vs Ripplewatch: compared",
    description,
    images: ["/opengraph-image"],
  },
};

export default function CompareIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Compare Ripplewatch to alternatives</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {COMPARISONS.map((entry) => (
          <li key={entry.slug} className="rounded-lg border border-border p-4">
            <Link href={`/compare/${entry.slug}`} className="group">
              <h2 className="font-medium tracking-tight group-hover:text-primary">
                Ripplewatch vs. {entry.name}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{entry.tagline}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="text-lg font-semibold tracking-tight">Before you shortlist</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed">
          <li>
            <Link
              href="/blog/g2-vs-gartner-vs-building-your-own-win-loss-process"
              className="text-primary hover:underline"
            >
              G2 vs. Gartner Peer Insights: what reviews can&apos;t tell you
            </Link>{" "}
            <span className="text-muted-foreground">
              Review sites help you build a shortlist. They can&apos;t tell you why you lose deals.
            </span>
          </li>
          <li>
            <Link href="/state-of-competitive-intelligence" className="text-primary hover:underline">
              The state of competitive intelligence tools
            </Link>{" "}
            <span className="text-muted-foreground">A survey of 20+ tools and what each one delivers.</span>
          </li>
        </ul>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        Already using one of these and thinking about switching? See{" "}
        <Link href="/alternatives" className="text-primary hover:underline">
          Ripplewatch as an alternative
        </Link>
        .
      </p>
    </div>
  );
}
