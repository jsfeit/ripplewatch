import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "From raw signal to a Momentum score",
    "See how Ripplewatch keeps watching after the chat ends, then rolls what it sees into one Momentum score."
  );
}
