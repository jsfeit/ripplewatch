import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FAQ_CATEGORIES } from "@/lib/faq";
import { FaqAccordion } from "./faq-accordion";

const description =
  "Answers on pricing and cancellation, how Ripplewatch's relevance scoring works, data security, and getting started.";

export const metadata = {
  title: "FAQ",
  description,
  alternates: { canonical: "/faq" },
  openGraph: { title: "FAQ — Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: {
    card: "summary_large_image",
    title: "FAQ — Ripplewatch",
    description,
    images: ["/opengraph-image"],
  },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
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
        <h1 className="text-3xl font-semibold tracking-tight">Frequently asked questions</h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
      </div>

      <FaqAccordion categories={FAQ_CATEGORIES} />

      <div className="mt-16 text-center">
        <p className="text-sm text-muted-foreground">Still have a question?</p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="mailto:hello@ripplewatch.ai" className={buttonVariants({ variant: "outline" })}>
            Email hello@ripplewatch.ai
          </a>
          <Link href="/waitlist" className={buttonVariants()}>
            Join the waitlist
          </Link>
        </div>
      </div>
    </div>
  );
}
