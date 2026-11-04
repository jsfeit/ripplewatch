import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "From raw signal to a Momentum score",
    "See how a competitor change gets scored against your won and lost deals, then rolled into one Momentum score."
  );
}
