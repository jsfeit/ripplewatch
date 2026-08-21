import { redirect } from "next/navigation";

// Competitor pricing folded into the single Dashboard page — this route
// just keeps old links/bookmarks working.
export default function PricingPage() {
  redirect("/app/dashboard#pricing");
}
