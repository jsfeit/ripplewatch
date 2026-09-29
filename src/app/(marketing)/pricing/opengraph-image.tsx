import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "Pricing that scales with your team",
    "Your AI competitive intelligence analyst, self-serve from $29/mo. Or a shared dashboard for the whole team."
  );
}
