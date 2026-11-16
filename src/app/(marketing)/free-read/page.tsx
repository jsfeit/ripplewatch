import { permanentRedirect } from "next/navigation";

// The free competitor read was retired. Old links and bookmarks land on pricing.
export default function FreeReadPage() {
  permanentRedirect("/pricing");
}
