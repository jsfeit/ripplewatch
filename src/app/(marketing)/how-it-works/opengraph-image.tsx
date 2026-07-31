import { renderOgImage, ogImageSize as size, ogImageContentType as contentType } from "@/lib/og-image";

export { size, contentType };

export default function Image() {
  return renderOgImage(
    "From raw signal to relevance verdict",
    "See how a competitor change gets scored against your positioning, ICP, and real lost-deal reasons."
  );
}
