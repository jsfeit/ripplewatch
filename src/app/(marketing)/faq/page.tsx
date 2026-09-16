import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FAQ_CATEGORIES } from "@/lib/faq";
import { FaqBrowser } from "./faq-browser";

const description =
  "Answers on pricing and cancellation, how Ripplewatch's relevance scoring works, data security, and getting started.";

export const metadata = {
  title: "FAQ",
  description,
  alternates: { canonical: "/faq" },
  openGraph: { title: "FAQ | Ripplewatch", description },
  twitter: {
    card: "summary_large_image",
    title: "FAQ | Ripplewatch",
    description,
  },
};

// Answers can contain simple inline HTML (e.g. a link) for on-page
// rendering — structured data wants plain text, so strip tags there.
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, "");

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: stripHtml(item.answer) },
    }))
  ),
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <div className="text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          FAQ
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Frequently asked questions
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <FaqBrowser categories={FAQ_CATEGORIES} />

      <div className="mt-16 border-t border-border pt-16 text-center">
        <p className="text-sm text-muted-foreground">Still have a question?</p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="mailto:hello@ripplewatch.ai" className={buttonVariants({ variant: "outline" })}>
            Email hello@ripplewatch.ai
          </a>
          <Link href="/pricing" className={buttonVariants()}>
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}
