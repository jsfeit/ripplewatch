import Link from "next/link";
import { Waves } from "lucide-react";

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
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
        </nav>
        <p className="text-xs text-muted-foreground">© 2026 Ripplewatch. ripplewatch.ai</p>
      </div>
    </footer>
  );
}
