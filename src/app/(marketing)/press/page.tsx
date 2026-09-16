import { ArrowUpRight } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

const description = "Where Ripplewatch has been featured and covered.";

export const metadata = {
  title: "Press",
  description,
  alternates: { canonical: "/press" },
  openGraph: { title: "Press | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Press | Ripplewatch", description, images: ["/opengraph-image"] },
};

// Real brand marks, used only where the platform has an actual official
// logo asset to source (via simple-icons, MIT-licensed SVG traces of each
// company's published mark) or a well-established generic icon (lucide's
// LinkedIn glyph). Capterra, SaaSHub, and SaaSWorthy don't have a reliable
// source for their mark, so those render as a plain wordmark instead of a
// guessed-at logo — better than shipping an invented "brand color" or a
// shape that isn't actually their logo.
function ProductHuntMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#DA552F" aria-hidden="true">
      <path d="M13.604 8.4h-3.405V12h3.405c.995 0 1.801-.806 1.801-1.801 0-.993-.805-1.799-1.801-1.799zM12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm1.604 14.4h-3.405V18H7.801V6h5.804c2.319 0 4.2 1.88 4.2 4.199 0 2.321-1.881 4.201-4.201 4.201z" />
    </svg>
  );
}

function G2Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#FF492C" aria-hidden="true">
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm.122 5.143c.45 0 .9.044 1.342.132l-1.342 2.806C9.962 8.08 8.203 9.84 8.203 12s1.76 3.92 3.92 3.92c.937 0 1.844-.338 2.553-.951l1.483 2.572A6.856 6.856 0 0 1 5.266 12a6.856 6.856 0 0 1 6.856-6.856Zm3.498.49a1.262 1.262 0 0 1 .026 0c.427 0 .792.113 1.101.34.31.229.466.546.466.946 0 .639-.36 1.03-1.035 1.376l-.377.191c-.403.204-.602.385-.657.706h2.05v.85h-3.101v-.144c0-.526.103-.96.314-1.306.211-.345.576-.65 1.102-.917l.242-.117c.427-.216.538-.401.538-.625 0-.266-.228-.458-.6-.458-.44 0-.773.228-1.004.694l-.592-.595c.13-.279.338-.502.619-.675a1.7 1.7 0 0 1 .908-.266Zm-2.094 5.388h3.394l1.697 2.937-1.697 2.94-1.697-2.94H11.83l1.696-2.937Z" />
    </svg>
  );
}

function CrunchbaseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#0288D1" aria-hidden="true">
      <path d="M21.6 0H2.4A2.41 2.41 0 0 0 0 2.4v19.2A2.41 2.41 0 0 0 2.4 24h19.2a2.41 2.41 0 0 0 2.4-2.4V2.4A2.41 2.41 0 0 0 21.6 0zM7.045 14.465A2.11 2.11 0 0 0 9.84 13.42h1.66a3.69 3.69 0 1 1 0-1.75H9.84a2.11 2.11 0 1 0-2.795 2.795zm11.345.845a3.55 3.55 0 0 1-1.06.63 3.68 3.68 0 0 1-3.39-.38v.38h-1.51V5.37h1.5v4.11a3.74 3.74 0 0 1 1.8-.63H16a3.67 3.67 0 0 1 2.39 6.46zm-.223-2.766a2.104 2.104 0 1 1-4.207 0 2.104 2.104 0 0 1 4.207 0z" />
    </svg>
  );
}

function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#0A66C2" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
    </svg>
  );
}

function WellfoundMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M23.998 8.128c.063-1.379-1.612-2.376-2.795-1.664-1.23.598-1.322 2.52-.156 3.234 1.2.862 2.995-.09 2.951-1.57zm0 7.748c.063-1.38-1.612-2.377-2.795-1.665-1.23.598-1.322 2.52-.156 3.234 1.2.863 2.995-.09 2.951-1.57zm-20.5 1.762L0 6.364h3.257l2.066 8.106 2.245-8.106h3.267l2.244 8.106 2.065-8.106h3.257l-3.54 11.274H11.39c-.73-2.713-1.46-5.426-2.188-8.14l-2.233 8.14H3.5z" />
    </svg>
  );
}

type PressLinkProps = {
  href: string;
  label: string;
  sublabel: string;
  mark?: React.ReactNode;
};

function PressLink({ href, label, sublabel, mark }: PressLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group block">
      <Panel className="flex h-full items-center gap-4 p-5 transition-colors group-hover:border-primary/40">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary",
            !mark && "bg-primary/10 text-primary"
          )}
        >
          {mark ?? <span className="text-sm font-semibold">{label[0]}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-none text-foreground">{label}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{sublabel}</p>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      </Panel>
    </a>
  );
}

const FEATURED = [
  {
    href: "https://www.producthunt.com/products/ripplewatch",
    label: "Product Hunt",
    sublabel: "Read the launch",
    mark: <ProductHuntMark className="size-6" />,
  },
  {
    href: "https://www.g2.com/products/ripplewatch/reviews",
    label: "G2",
    sublabel: "View profile & reviews",
    mark: <G2Mark className="size-6" />,
  },
  {
    href: "https://www.capterra.com/p/10182398/Ripplewatch/",
    label: "Capterra",
    sublabel: "View profile & reviews",
  },
  {
    href: "https://www.saashub.com/ripplewatch-ai-alternatives",
    label: "SaaSHub",
    sublabel: "View listing",
  },
  {
    href: "https://www.saasworthy.com/product/ripplewatch",
    label: "SaaSWorthy",
    sublabel: "View listing",
  },
];

const ELSEWHERE = [
  {
    href: "https://www.linkedin.com/company/ripplewatch/",
    label: "LinkedIn",
    sublabel: "Follow the company page",
    mark: <LinkedInMark className="size-6" />,
  },
  {
    href: "https://wellfound.com/company/ripplewatch",
    label: "Wellfound",
    sublabel: "Company profile",
    mark: <WellfoundMark className="size-5" />,
  },
  {
    href: "https://www.crunchbase.com/organization/ripplewatch",
    label: "Crunchbase",
    sublabel: "Company profile",
    mark: <CrunchbaseMark className="size-6" />,
  },
];

export default function PressPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pb-4 pt-20 text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Press & mentions
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Press</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Where Ripplewatch has been featured, listed, and covered.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <a
          href="https://postyourstartup.co/startup/ripplewatch?ref=badge"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-10 flex justify-center"
        >
          <img
            src="https://postyourstartup.co/api/badge/ripplewatch?theme=neutral"
            alt="Featured on PostYourStartup"
            width={212}
            height={55}
          />
        </a>

        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Featured on</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FEATURED.map((item) => (
            <PressLink key={item.label} {...item} />
          ))}
        </div>

        <h2 className="mt-12 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Find us elsewhere
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {ELSEWHERE.map((item) => (
            <PressLink key={item.label} {...item} />
          ))}
        </div>
      </section>
    </>
  );
}
