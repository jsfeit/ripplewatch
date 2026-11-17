import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "One flat fee, pay for what you use",
    "Competitor Momentum, watched every day and scored against your deals. From $29/mo plus usage you prepay for."
  );
}
