import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

// The default 404 had no navigation at all, so anyone who landed on a bad link had nowhere to go.
// This keeps the site's header and footer and points to the pages people actually want.
export default function NotFound() {
  const links = [
    { href: "/connect", label: "Product", note: "An AI analyst inside Claude or ChatGPT" },
    { href: "/compare", label: "Compare", note: "Ripplewatch against Crayon, Klue and others" },
    { href: "/blog", label: "Blog", note: "Notes on competitive intelligence and win/loss" },
    { href: "/competitor-snapshot", label: "Free competitor snapshot", note: "A one-time read on any competitor" },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">That page isn&apos;t here</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The link may be old or mistyped. Here are the places most people are looking for.
        </p>
        <ul className="mt-8 space-y-3">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 hover:border-primary/50"
              >
                <span>
                  <span className="block font-medium">{l.label}</span>
                  <span className="block text-sm text-muted-foreground">{l.note}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-8" })}>
          Back to the home page
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
