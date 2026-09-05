import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "From raw signal to a Momentum score",
    "Not alerts. Not data. Answers. See how a competitor change gets scored, then rolled into one directional score."
  );
}
