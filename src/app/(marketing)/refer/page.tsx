import Link from "next/link";
import { Gift, Radar, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

const description =
  "You were referred to Ripplewatch: sign up and get 2 months free. Companies know companies, and they know who actually gives good intel.";

export const metadata = {
  title: "You're invited",
  description,
  alternates: { canonical: "/refer" },
  robots: { index: false, follow: true }, // personalized landing page, not for search
  openGraph: { title: "You're invited to Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "You're invited to Ripplewatch", description, images: ["/opengraph-image"] },
};

// Looks up the referring company's name for a personalized headline:
// public info (a company name), read via the admin client since this page
// has no signed-in session. Falls back to generic copy if the code is
// missing or doesn't resolve to a real account.
async function referrerName(code: string | undefined): Promise<string | null> {
  if (!code || !isSupabaseConfigured()) return null;
  const { data } = await createAdminClient()
    .from("accounts")
    .select("name")
    .eq("referral_code", code.trim().toUpperCase())
    .maybeSingle();
  return data?.name ?? null;
}

export default async function ReferPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const referrer = await referrerName(ref);
  const signupHref = ref ? `/signup?ref=${encodeURIComponent(ref)}` : "/signup";

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Gift className="size-4" />
        You&apos;re invited
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {referrer ? `${referrer} thinks you'd get real value from Ripplewatch` : "Get 2 months free on Ripplewatch"}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Companies know companies, and the ones already using Ripplewatch to track their competitors are
        exactly the ones best positioned to know who actually gives good intel, and who&apos;s just another
        dashboard nobody opens.
      </p>

      <div className="mt-8 rounded-xl border border-primary/30 bg-primary/[0.04] p-6">
        <p className="text-sm font-semibold">The offer</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign up through this link and your first two months are free. No code to enter, it&apos;s applied
          automatically the moment you check out.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <Radar className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">Every signal, actually scored</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pricing changes, job postings, news, funding: scored against your own positioning and history,
            not dumped in a generic feed.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <Users className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">Set up in minutes</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tell us your positioning and who you compete with. Alerts start showing up as soon as the
            first crawl runs.
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href={signupHref} className={buttonVariants({ size: "lg" })}>
          Claim your 2 free months
        </Link>
        <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
          See full pricing
        </Link>
      </div>
    </div>
  );
}
