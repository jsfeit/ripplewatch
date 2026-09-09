import { DollarSign, Megaphone, Zap } from "lucide-react";
import { AffiliateApplicationForm } from "../affiliates/affiliate-application-form";

const description =
  "Write, film, or post about SaaS, indie hacking, or startup growth? Partner with Ripplewatch: 45% recurring commission for 6 months on every signup you send our way.";

export const metadata = {
  title: "For creators",
  description,
  alternates: { canonical: "/creators" },
  openGraph: { title: "For creators | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "For creators | Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function CreatorsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Partner with Ripplewatch</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        For newsletter writers, YouTubers, podcasters, and X/LinkedIn creators whose audience is early-stage
        SaaS founders, indie hackers, or B2B marketers. If that&apos;s your audience, tell them about a tool
        they&apos;d actually use, and get paid for it.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <DollarSign className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">45% recurring for 6 months</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            45% of every subscription your audience starts, every month, for 6 months. Tracked automatically
            through your own referral link, no manual reporting.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <Megaphone className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">A real fit, not a filler ad</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ripplewatch is built for exactly the people you already talk to: founders who need to know what
            their competitors are doing, without checking five tabs a day.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <Zap className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">Real assets, real answers</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Screenshots, a demo account, talking points, whatever makes the mention easy to write or film. You
            work directly with the founder, not a partner portal.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium">Apply</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us about your audience and where you&apos;d mention us. We read every application ourselves.
        </p>
        <div className="mt-4">
          <AffiliateApplicationForm
            program="creator"
            whyGoodFitPlaceholder="e.g. I run a YouTube channel for indie hackers, ~15K subscribers, mostly early-stage SaaS founders."
            channelsPlaceholder="e.g. Newsletter, YouTube, a podcast, X or LinkedIn, a roundup post..."
          />
        </div>
      </div>
    </div>
  );
}
