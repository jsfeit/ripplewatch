"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DollarSign, LayoutDashboard, LogOut, Menu, Radar, Settings, Sparkles, TrendingUp, Waves, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { TIER_DOT } from "@/lib/tier-style";

const NAV = [
  { href: "/app/dashboard", label: "News", icon: LayoutDashboard },
  { href: "/app/ask", label: "Ask", icon: Sparkles },
  { href: "/app/pricing", label: "Pricing", icon: DollarSign },
  { href: "/app/trends", label: "Trends", icon: TrendingUp },
  { href: "/app/competitors", label: "Competitors", icon: Radar },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  advanced: "Advanced",
};

export function AppSidebar({ tier }: { tier: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Closes the mobile drawer on navigation. Adjusted during render (React's
  // recommended pattern for resetting state on a prop change) rather than
  // in an effect, so there's no extra render pass after the route changes.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 lg:hidden">
        <Link href="/app/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30">
            <Waves className="size-3.5" />
          </span>
          Ripplewatch
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-60 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2.5 border-b border-sidebar-border px-5 font-semibold tracking-tight">
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              <Waves className="size-4" />
            </span>
            Ripplewatch
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href.includes("/competitors") && pathname.startsWith("/app/competitors"));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                {active ? (
                  <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                ) : null}
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5">
            <span className="text-xs font-medium text-sidebar-foreground/60">Plan</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-sidebar-foreground">
              <span className={cn("size-1.5 rounded-full", TIER_DOT[tier] ?? TIER_DOT.starter)} />
              {TIER_LABELS[tier] ?? tier}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </aside>
    </>
  );
}
