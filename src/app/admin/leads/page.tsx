import { redirect } from "next/navigation";

// Leads now live alongside users in one table.
export default function AdminLeadsPage() {
  redirect("/admin/users?show=leads");
}
