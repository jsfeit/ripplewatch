import Link from "next/link";
import { COMPARISONS } from "@/lib/comparisons";

const description = "Considering a switch? See how Ripplewatch compares as an alternative to other competitive intelligence tools.";

export const metadata = {
  title: "Ripplewatch alternatives to other CI tools",
  description,
  alternates: { canonical: "/alternatives" },
  openGraph: { title: "Ripplewatch alternatives to other CI tools | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: {
    card: "summary_large_image",
    title: "Ripplewatch alternatives to other CI tools | Ripplewatch",
    description,
    images: ["/opengraph-image"],
  },
};

export default function AlternativesIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Looking for an alternative?</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {COMPARISONS.map((entry) => (
          <li key={entry.slug} className="rounded-lg border border-border p-4">
            <Link href={`/alternatives/${entry.slug}`} className="group">
              <h2 className="font-medium tracking-tight group-hover:text-primary">
                {entry.name} alternative
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{entry.tagline}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm text-muted-foreground">
        Prefer a side-by-side feature comparison instead? See how Ripplewatch{" "}
        <Link href="/compare" className="text-primary hover:underline">
          stacks up against each tool
        </Link>
        .
      </p>
    </div>
  );
}
