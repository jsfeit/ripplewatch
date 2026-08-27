"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Waves, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DemoLink } from "@/components/marketing/demo-link";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="size-4" />
          </span>
          Ripplewatch
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <DemoLink />
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}
          >
            See it in action
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}
          >
            Sign in
          </Link>
          <Link href="/pricing" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
            Get started
          </Link>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md text-foreground sm:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="flex flex-col gap-1 border-t border-border/70 bg-background px-6 py-4 sm:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <DemoLink
            variant="text"
            className="rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-secondary hover:text-foreground"
          />
          <Link
            href="/onboarding"
            className="rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            See it in action
          </Link>
          <Link
            href="/login"
            className="rounded-md px-2 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href="/pricing"
            className={cn(buttonVariants(), "mt-2 w-full")}
            onClick={() => setOpen(false)}
          >
            Get started
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
