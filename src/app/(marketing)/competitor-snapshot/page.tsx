import { permanentRedirect } from "next/navigation";

// The free competitor snapshot was retired. Old links and bookmarks land on pricing.
export default function CompetitorSnapshotPage() {
  permanentRedirect("/pricing");
}
