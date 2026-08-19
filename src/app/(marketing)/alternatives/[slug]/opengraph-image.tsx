import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";
import { COMPARISONS, getComparison } from "@/lib/comparisons";

export { size, contentType };

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComparison(slug);
  const name = entry?.name ?? "a competitor";

  return renderOgImage(`${name} Alternative: Ripplewatch`, entry?.tagline ?? "See how Ripplewatch compares.");
}
