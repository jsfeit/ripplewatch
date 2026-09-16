const description = "Where Ripplewatch has been featured and covered.";

export const metadata = {
  title: "Press",
  description,
  alternates: { canonical: "/press" },
  openGraph: { title: "Press | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Press | Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function PressPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Press</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">Where Ripplewatch has been featured and covered.</p>

      <div className="mt-10 flex flex-wrap items-center gap-6">
        <a href="https://postyourstartup.co/startup/ripplewatch?ref=badge" target="_blank" rel="noopener noreferrer">
          <img
            src="https://postyourstartup.co/api/badge/ripplewatch?theme=neutral"
            alt="Featured on PostYourStartup"
            width={212}
            height={55}
          />
        </a>
        <a
          href="https://www.producthunt.com/products/ripplewatch"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[55px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
        >
          Ripplewatch on Product Hunt
        </a>
        <a
          href="https://www.g2.com/products/ripplewatch/reviews"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[55px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
        >
          Ripplewatch on G2
        </a>
        <a
          href="https://www.capterra.com/p/10182398/Ripplewatch/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[55px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
        >
          Ripplewatch on Capterra
        </a>
        <a
          href="https://www.saashub.com/ripplewatch-ai-alternatives"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[55px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
        >
          Ripplewatch on SaaSHub
        </a>
        <a
          href="https://www.saasworthy.com/product/ripplewatch"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[55px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
        >
          Ripplewatch on SaaSWorthy
        </a>
      </div>

      <h2 className="mt-12 text-sm font-semibold text-muted-foreground">Find us elsewhere</h2>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <a
          href="https://www.linkedin.com/company/ripplewatch/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[55px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
        >
          LinkedIn
        </a>
        <a
          href="https://wellfound.com/company/ripplewatch"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[55px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
        >
          Wellfound
        </a>
        <a
          href="https://www.crunchbase.com/organization/ripplewatch"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[55px] items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:border-primary/40"
        >
          Crunchbase
        </a>
      </div>
    </div>
  );
}
