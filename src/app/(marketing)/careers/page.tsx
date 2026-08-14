import { MapPin, Clock, Building2 } from "lucide-react";
import { CareersForm } from "./careers-form";

const description =
  "We're a small team building AI-native competitive intelligence. If you don't see a fit, pitch us your own role.";

export const metadata = {
  title: "Careers",
  description,
  alternates: { canonical: "/careers" },
  openGraph: { title: "Careers | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Careers | Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function CareersPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Careers</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        We&apos;re a small team, so we&apos;re not hiring against a fixed list of roles right now.
        If you think you&apos;d be a strong addition, tell us what role you&apos;d want to fill.
      </p>

      <div className="mt-10 rounded-xl border border-border bg-secondary/30 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">General</p>
        <h2 className="mt-2 text-lg font-medium">Create your own role</h2>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5" />
            General
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            Remote
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            Full time
          </span>
        </div>
      </div>

      <div className="mt-10">
        <CareersForm />
      </div>
    </div>
  );
}
