import { Waves } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Confirm your email", robots: { index: false, follow: false } };

// A real click, not a bare page load, triggers the actual verification (see
// /api/auth/confirm). Email providers' link scanners fetch every URL in an
// email to check it for malware, and a GET-based confirmation link that
// verifies on load gets consumed by that scan before the person ever clicks
// it — Supabase's one-time token comes back "already used," and the real
// click fails with an expired-token error. Scanners fetch pages; they don't
// submit forms, so gating the actual verification behind this button click
// (a real POST) is what defeats them.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Waves className="size-4" />
            </span>
            Ripplewatch
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-20">
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Confirm your email</h1>
          {token_hash && type ? (
            <>
              <p className="text-sm text-muted-foreground">One click and you&apos;re in.</p>
              <form action="/api/auth/confirm" method="POST">
                <input type="hidden" name="token_hash" value={token_hash} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="next" value={next ?? "/"} />
                <button type="submit" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                  Confirm email
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This link is missing some information. Copy the confirmation link from your email again, or request a
              new one.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
