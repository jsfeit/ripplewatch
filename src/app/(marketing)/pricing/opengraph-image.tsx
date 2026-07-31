import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "Pricing that scales with your team",
    "Relevance-scored competitive intelligence starting at $69/mo, self-serve on every tier."
  );
}
