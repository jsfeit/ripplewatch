import { redirect } from "next/navigation";

// Competitor list-management moved into Settings; a specific competitor's
// fact sheet still lives at /app/competitors/[id] (unchanged). This bare
// index just keeps old links/bookmarks working.
export default function CompetitorsIndexPage() {
  redirect("/app/settings?tab=competitors");
}
