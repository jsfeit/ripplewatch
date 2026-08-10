import { redirect } from "next/navigation";

// Key metrics was merged into Trends — this stub only exists so old
// bookmarks/links to /app/key-metrics still land somewhere real.
export default function KeyMetricsRedirect() {
  redirect("/app/trends");
}
