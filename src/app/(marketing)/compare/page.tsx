import Link from "next/link";
import { COMPARISONS } from "@/lib/comparisons";

const description = "How Ripplewatch compares to other competitive intelligence and market intelligence tools.";

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
    </div>
  );
}
