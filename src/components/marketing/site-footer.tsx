import Link from "next/link";
import { Waves } from "lucide-react";

// lucide-react doesn't ship brand icons — inline glyph instead.
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
    </svg>
  );
}

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/connect", label: "Overview" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/free-read", label: "Free competitor read" },
      { href: "/competitor-snapshot", label: "Competitor Snapshot" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/compare", label: "Compare" },
      { href: "/alternatives", label: "Alternatives" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/security", label: "Security" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/terms#subprocessors", label: "Subprocessors" },
    ],
  },
];

// Pages that matter to a few visitors (press, partners, hiring) but not to
// someone deciding whether to buy, so they sit in the bottom bar.
const MORE_LINKS = [
  { href: "/state-of-competitive-intelligence", label: "Research" },
  { href: "/competitive-intelligence-quiz", label: "CI Quiz" },
  { href: "/press", label: "Press" },
  { href: "/careers", label: "Careers" },
  { href: "/affiliates", label: "Affiliates" },
  { href: "/creators", label: "For creators" },
  { href: "/refer", label: "Refer a friend" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Waves className="size-4" />
              Ripplewatch
            </div>
            <p className="max-w-[22ch] text-sm text-muted-foreground">
              The AI competitive intelligence analyst in Claude and ChatGPT.
            </p>
            <Link
              href="/login"
              className="inline-flex w-fit items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Sign in
            </Link>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {column.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/70 pt-8 sm:flex-row">
          <div className="flex flex-col items-center gap-3 sm:items-start">
            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-start">
              {MORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">© 2026 Ripplewatch. ripplewatch.ai</p>
          </div>
          <a
            href="https://www.linkedin.com/company/ripplewatch/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-6 items-center justify-center text-muted-foreground hover:text-foreground"
            title="Ripplewatch on LinkedIn"
          >
            <LinkedinIcon className="size-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
