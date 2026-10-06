import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { parseUnsubscribeList, verifyAccountUnsubscribe, type UnsubscribeList } from "@/lib/unsubscribe-token";

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
  const list = parseUnsubscribeList(String(formData.get("list") ?? ""));
  if (!verifyAccountUnsubscribe(account, sig, list)) redirect("/unsubscribe");
  const update =
    list === "daily"
      ? { connect_daily_alert_enabled: false }
      : list === "monthly"
        ? { connect_monthly_recap_enabled: false }
        : { onboarding_emails_unsubscribed_at: new Date().toISOString() };
  await createAdminClient().from("accounts").update(update).eq("id", account);
  redirect(`/unsubscribe?account=${account}&sig=${sig}&done=1${list === "onboarding" ? "" : `&list=${list}`}`);
}

// What each list is called on the page. Every list says what is NOT affected,
// so nobody opts out of the weekly briefing by accident.
const LIST_COPY: Record<UnsubscribeList, { title: string; done: string; ask: string; button: string }> = {
  onboarding: {
    title: "Stop the setup emails?",
    done: "You won't get any more setup emails. Your weekly briefing and account emails aren't affected.",
    ask: "We'll stop the getting-started emails for this account. Your weekly briefing and account emails aren't affected.",
    button: "Stop setup emails",
  },
  daily: {
    title: "Stop the daily alerts?",
    done: "You won't get daily alerts any more. Your weekly briefing and monthly recap aren't affected, and you can turn alerts back on in Settings.",
    ask: "We'll stop the daily alerts for this account. Your weekly briefing and monthly recap aren't affected.",
    button: "Stop daily alerts",
  },
  monthly: {
    title: "Stop the monthly recap?",
    done: "You won't get the monthly recap any more. Your weekly briefing and daily alerts aren't affected, and you can turn it back on in Settings.",
    ask: "We'll stop the monthly recap for this account. Your weekly briefing and daily alerts aren't affected.",
    button: "Stop monthly recap",
  },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; account?: string; sig?: string; done?: string; list?: string }>;
}) {
  const { lead, account, sig, done, list: listParam } = await searchParams;
  const list = parseUnsubscribeList(listParam);

  if (account && sig && isSupabaseConfigured() && verifyAccountUnsubscribe(account, sig, list)) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {done ? "You're unsubscribed" : LIST_COPY[list].title}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {done ? LIST_COPY[list].done : LIST_COPY[list].ask}
        </p>
        {done ? null : (
          <form action={confirmAccountUnsubscribe} className="mt-6">
            <input type="hidden" name="account" value={account} />
            <input type="hidden" name="sig" value={sig} />
            <input type="hidden" name="list" value={list} />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {LIST_COPY[list].button}
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
