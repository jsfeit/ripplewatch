import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The Ripplewatch Connect signup funnel, read straight from data the app
// already keeps: no tracking table, no extra cost, and no consent banner in
// the way. Every person who signed up in the window is followed through the
// stages below, so a number is "of the people who signed up, how many got
// this far". Stages aren't strictly sequential (someone can add a competitor
// before connecting their assistant), which is why each is shown against the
// signup total as well as the stage before it.
//
// Visitors and pageviews before signup aren't here: they live in Vercel
// Analytics (free, cookieless) and in Google Analytics (consent only).

export type FunnelStage = { key: string; label: string; hint: string; count: number };

export type ConnectFunnel = {
  sinceDays: number | null;
  stages: FunnelStage[];
  // People stuck at the two cliffs that are easy to miss.
  stuckUnconfirmed: number;
  stuckUnpaid: number;
};


// Admin emails and their plus-address aliases (you+test1@gmail.com): the test
// signups made while building this shouldn't count as customers.
function isOwnerEmail(email: string, adminEmails: string[]): boolean {
  const [local, domain] = email.toLowerCase().split("@");
  const base = `${local.split("+")[0]}@${domain}`;
  return adminEmails.some((a) => a === email.toLowerCase() || a === base);
}

const CHUNK = 150;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

export async function getConnectFunnel(sinceDays: number | null, extraOwnerEmails: string[] = []): Promise<ConnectFunnel> {
  const admin = createAdminClient();
  const cutoff = sinceDays ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : 0;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .concat(extraOwnerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean));

  // Auth users: the only place a person who never confirmed their email exists.
  const users: { id: string; confirmed: boolean }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) break;
    for (const u of data.users) {
      if (new Date(u.created_at).getTime() < cutoff) continue;
      if (u.email && isOwnerEmail(u.email, adminEmails)) continue;
      users.push({ id: u.id, confirmed: Boolean(u.email_confirmed_at) });
    }
    if (data.users.length < 1000) break;
  }

  const userIds = users.map((u) => u.id);
  const accountByUser = new Map<string, string>();
  for (const ids of chunks(userIds)) {
    const { data } = await admin.from("profiles").select("id, account_id").in("id", ids);
    for (const p of data ?? []) if (p.account_id) accountByUser.set(p.id, p.account_id);
  }

  const accountIds = [...new Set(accountByUser.values())];
  type Acct = { tier: string; status: string; context: boolean; connected: boolean };
  const accounts = new Map<string, Acct>();
  for (const ids of chunks(accountIds)) {
    const { data } = await admin
      .from("accounts")
      .select("id, tier, status, positioning, icp, mcp_last_connected_at")
      .in("id", ids);
    for (const a of data ?? []) {
      accounts.set(a.id, {
        tier: a.tier,
        status: a.status,
        context: Boolean(a.positioning?.trim() || a.icp?.trim()),
        connected: Boolean(a.mcp_last_connected_at),
      });
    }
  }

  const withRows = async (table: "competitors" | "competitor_win_loss" | "integrations") => {
    const set = new Set<string>();
    for (const ids of chunks(accountIds)) {
      if (table === "integrations") {
        const { data } = await admin
          .from("integrations")
          .select("account_id")
          .in("account_id", ids)
          .eq("provider", "slack")
          .eq("connected", true);
        for (const r of data ?? []) set.add(r.account_id);
      } else {
        const { data } = await admin.from(table).select("account_id").in("account_id", ids);
        for (const r of data ?? []) set.add(r.account_id);
      }
    }
    return set;
  };
  const [hasCompetitor, hasDeal, hasSlack] = await Promise.all([
    withRows("competitors"),
    withRows("competitor_win_loss"),
    withRows("integrations"),
  ]);

  let confirmed = 0;
  let hasAccount = 0;
  let paid = 0;
  let context = 0;
  let competitor = 0;
  let connected = 0;
  let slack = 0;
  let deal = 0;
  let stuckUnconfirmed = 0;
  let stuckUnpaid = 0;

  for (const u of users) {
    if (u.confirmed) confirmed++;
    else stuckUnconfirmed++;
    const accountId = accountByUser.get(u.id);
    const acct = accountId ? accounts.get(accountId) : undefined;
    if (!acct || acct.tier !== "connect") continue;
    hasAccount++;
    if (acct.status !== "active") {
      stuckUnpaid++;
      continue;
    }
    paid++;
    if (acct.context) context++;
    if (hasCompetitor.has(accountId!)) competitor++;
    if (acct.connected) connected++;
    if (hasSlack.has(accountId!)) slack++;
    if (hasDeal.has(accountId!)) deal++;
  }

  return {
    sinceDays,
    stuckUnconfirmed,
    stuckUnpaid,
    stages: [
      { key: "signup", label: "Signed up", hint: "Created a login", count: users.length },
      { key: "confirmed", label: "Confirmed email", hint: "Clicked the link in the confirmation email", count: confirmed },
      { key: "account", label: "Account created", hint: "Finished the company step after confirming", count: hasAccount },
      { key: "paid", label: "Paid and active", hint: "Platform fee and opening balance went through", count: paid },
      { key: "context", label: "Told it about the business", hint: "Positioning or ideal customer filled in", count: context },
      { key: "competitor", label: "Added a competitor", hint: "At least one competitor tracked", count: competitor },
      { key: "connected", label: "Connected an assistant", hint: "Claude or ChatGPT reached the server", count: connected },
      { key: "slack", label: "Connected Slack", hint: "Optional", count: slack },
      { key: "deal", label: "Logged a deal", hint: "At least one win or loss on record", count: deal },
    ],
  };
}
