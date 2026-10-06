import Link from "next/link";
import { COMPARISONS } from "@/lib/comparisons";

const description =
  "How Ripplewatch, an AI analyst that works inside Claude and other assistants over MCP, compares to Crayon, Klue, Kompyte and other competitive intelligence tools.";

export const metadata = {
  title: "Compare Ripplewatch to alternatives",
  description,
  alternates: { canonical: "/compare" },
  openGraph: { title: "Compare Ripplewatch to alternatives | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: {
    card: "summary_large_image",
    title: "Compare Ripplewatch to alternatives | Ripplewatch",
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
