import { redirect } from "next/navigation";

// Trends folded into the single Dashboard page — this route just keeps old
// links/bookmarks working.
export default function TrendsPage() {
  redirect("/app/dashboard#trends");
}
