import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "Frequently asked questions",
    "Pricing, cancellation, relevance scoring, data security, and getting started."
  );
}
