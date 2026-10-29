import { FreeReadTool } from "@/components/marketing/free-read-tool";

const description =
  "Name up to three competitors. Watch Ripplewatch read their pricing (with a year of history), hiring and news, then tell you who is heating up, who is cooling off, and what it means for you.";

export const metadata = {
  title: "Free competitor read",
  description,
  alternates: { canonical: "/free-read" },
  openGraph: { title: "Free competitor read | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image" as const, title: "Free competitor read | Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function FreeReadPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Free, about a minute</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Who&apos;s heating up, who&apos;s cooling off, and what changed?
        </h1>
        <p className="mt-4 text-muted-foreground">{description}</p>
      </div>
      <div className="mt-10">
        <FreeReadTool />
      </div>
    </div>
  );
}
