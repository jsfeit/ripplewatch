import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  let ok = false;

  if (lead && isSupabaseConfigured()) {
    const { error } = await createAdminClient()
      .from("leads")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", lead);
    ok = !error;
  }

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {ok ? "You're unsubscribed" : "Nothing to unsubscribe"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {ok
          ? "You won't get any more follow-up emails from us about signing up."
          : "That link looks invalid or already used. If you're still getting emails you don't want, just reply and let us know."}
      </p>
    </div>
  );
}
