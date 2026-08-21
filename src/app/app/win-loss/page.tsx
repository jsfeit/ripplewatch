import { redirect } from "next/navigation";

// Win/loss folded into the single Dashboard page — this route just keeps
// old links/bookmarks working.
export default function WinLossPage() {
  redirect("/app/dashboard#win-loss");
}
