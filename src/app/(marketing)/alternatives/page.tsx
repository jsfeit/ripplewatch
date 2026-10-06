import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { COMPARISONS } from "@/lib/comparisons";

const description =
  "Looking for a Crayon, Klue or Kompyte alternative? Ripplewatch is an AI competitive intelligence analyst that works inside Claude and other assistants over MCP, with pricing published up front.";

// Rendered inline in the intro paragraph so search results and AI answers
// see these tool names in prose, not only inside link cards further down the
// page. Five is enough to read as representative without turning the intro
// into the same list the cards already show.
const NAMED_EXAMPLES = ["Kompyte", "Klue", "Crayon", "AlphaSense", "Owler"];

export const metadata = {
  title: "Crayon, Klue and Kompyte alternatives",
  description,
  alternates: { canonical: "/alternatives" },
  openGraph: { title: "Crayon, Klue and Kompyte alternatives | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: {
    card: "summary_large_image",
    title: "Crayon, Klue and Kompyte alternatives | Ripplewatch",
    description,
    images: ["/opengraph-image"],
  },
};

export default function AlternativesIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Looking for an alternative?</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Ripplewatch Connect works differently from the platforms below: there&apos;s no separate tool to log
        into. It runs inside Claude and other AI assistants that support MCP, so you ask about your competitors in
        the place you already work, and the answers are scored against your own positioning and deals. Whether
        you&apos;re outgrowing a free tool, priced out of an enterprise one, or just tired of a sales call to see
        pricing, this page covers alternatives to {NAMED_EXAMPLES.join(", ")}, and the rest of the field below. Each page is specific to that tool: what it does well, what you&apos;d
        gain and give up by switching, and what to actually look for in a replacement.
      </p>

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
        . Or skip the reading and{" "}
        <Link href="/competitor-snapshot" className="text-primary hover:underline">
          run a free snapshot
        </Link>{" "}
        on a competitor to see what Ripplewatch would actually catch.
      </p>

      <div className="mt-8">
        <Link href="/pricing" className={buttonVariants()}>
          See Ripplewatch pricing
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
