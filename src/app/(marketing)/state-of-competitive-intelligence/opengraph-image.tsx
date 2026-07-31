import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "The State of Competitive Intelligence",
    "A survey of 20+ CI tools, from enterprise research platforms to the new wave of AI-native monitoring."
  );
}
