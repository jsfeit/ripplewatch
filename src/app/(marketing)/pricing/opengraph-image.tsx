import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "One flat fee, pay for what you use",
    "Your AI competitive intelligence analyst, from $29/mo plus usage you prepay for."
  );
}
