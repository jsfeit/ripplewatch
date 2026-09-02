import { DollarSign, Users, Zap } from "lucide-react";
import { AffiliateApplicationForm } from "./affiliate-application-form";

const description =
  "Partner with Ripplewatch: generous recurring commissions for anyone with an audience of B2B founders, marketers, or sales leaders.";

export const metadata = {
  title: "Affiliates",
  description,
  alternates: { canonical: "/affiliates" },
  openGraph: { title: "Affiliates | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Affiliates | Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function AffiliatesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Become a Ripplewatch affiliate</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        We&apos;re looking for a small number of partners who already talk to the people Ripplewatch is built
        for: startup founders, marketers, and sales leaders who need a real read on their competitors, not
        another dashboard nobody opens.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <DollarSign className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">Generous recurring commissions</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Earn on every subscription you send our way, for as long as they stay a customer, not a one-time
            payout. Exact rates depend on your channel and reach; we&apos;ll work those out with you directly.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <Users className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">A product worth recommending</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every signal we surface is actually scored against a company&apos;s own positioning and history, not
            just dumped in a feed. The kind of thing you can put your name behind.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/30 p-5">
          <Zap className="size-5 text-primary" />
          <h2 className="mt-3 text-sm font-semibold">Direct access, not a portal</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            No self-serve affiliate network middleman. You work directly with our team: real answers, real
            creative assets, real conversations about what&apos;s converting.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium">Apply</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us a bit about your audience and where you&apos;d promote us. We read every application
          ourselves.
        </p>
        <div className="mt-4">
          <AffiliateApplicationForm />
        </div>
      </div>
    </div>
  );
}
