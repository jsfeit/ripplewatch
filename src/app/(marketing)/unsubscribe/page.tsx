import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { verifyAccountUnsubscribe } from "@/lib/unsubscribe-token";

export const metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

// Opting a paying account out of its setup emails needs a deliberate click:
// some mail providers fetch every link in a message to scan it, and a link
// that unsubscribed on load would quietly opt people out. The lead flow below
// predates this and still acts on load.
async function confirmAccountUnsubscribe(formData: FormData) {
  "use server";
  const account = String(formData.get("account") ?? "");
  const sig = String(formData.get("sig") ?? "");
  if (!verifyAccountUnsubscribe(account, sig)) redirect("/unsubscribe");
  await createAdminClient()
    .from("accounts")
    .update({ onboarding_emails_unsubscribed_at: new Date().toISOString() })
    .eq("id", account);
  redirect(`/unsubscribe?account=${account}&sig=${sig}&done=1`);
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; account?: string; sig?: string; done?: string }>;
}) {
  const { lead, account, sig, done } = await searchParams;

  if (account && sig && isSupabaseConfigured() && verifyAccountUnsubscribe(account, sig)) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {done ? "You're unsubscribed" : "Stop the setup emails?"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {done
            ? "You won't get any more setup emails. Your weekly briefing and account emails aren't affected."
            : "We'll stop the getting-started emails for this account. Your weekly briefing and account emails aren't affected."}
        </p>
        {done ? null : (
          <form action={confirmAccountUnsubscribe} className="mt-6">
            <input type="hidden" name="account" value={account} />
            <input type="hidden" name="sig" value={sig} />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Stop setup emails
            </button>
          </form>
        )}
      </div>
    );
  }

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
