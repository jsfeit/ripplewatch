import { Suspense } from "react";
import Link from "next/link";
import { Waves } from "lucide-react";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata = { title: "Set up your workspace — Ripplewatch" };

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Waves className="size-4" />
            </span>
            Ripplewatch
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Suspense>
          <OnboardingFlow />
        </Suspense>
      </main>
    </div>
  );
}
