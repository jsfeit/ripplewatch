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

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Waves className="size-4" />
          Ripplewatch
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/how-it-works" className="hover:text-foreground">How it works</Link>
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/waitlist" className="hover:text-foreground">Join waitlist</Link>
          <Link href="/onboarding" className="hover:text-foreground">Live demo</Link>
          <Link href="/state-of-competitive-intelligence" className="hover:text-foreground">Research</Link>
          <Link href="/faq" className="hover:text-foreground">FAQ</Link>
          <Link href="/careers" className="hover:text-foreground">Careers</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/subprocessors" className="hover:text-foreground">Subprocessors</Link>
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
        </nav>
        <div className="flex items-center gap-4">
          <p className="text-xs text-muted-foreground">© 2026 Ripplewatch. ripplewatch.ai</p>
          {/* No LinkedIn page yet — icon is a placeholder, not a link. */}
          <span
            className="flex size-6 items-center justify-center text-muted-foreground/50"
            title="LinkedIn — coming soon"
          >
            <LinkedinIcon className="size-4" />
          </span>
        </div>
      </div>
    </footer>
  );
}
