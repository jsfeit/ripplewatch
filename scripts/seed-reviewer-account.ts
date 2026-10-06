// Creates the dedicated demo account OpenAI's reviewers sign in with when they
// test the ChatGPT plugin: a funded, demo-mode Connect account with a password
// (reviewers can't use magic links or email codes), a positioning and ICP, a
// few tracked competitors and some logged deals, so each test case has data to
// work with. The password is written to chatgpt-plugin/.reviewer-credentials.local
// (gitignored) and never printed.
//
// Run: npx tsx --conditions react-server scripts/seed-reviewer-account.ts
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { addCompetitor } from "@/lib/competitor-add";
import { logWinLoss } from "@/lib/win-loss-log";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const EMAIL = "chatgpt-review@ripplewatch.ai";
const COMPANY = "Fieldnote";
const POSITIONING =
  "Fieldnote is project documentation software for small product teams: one searchable home for specs, decisions and meeting notes that stays in sync with the work.";
const ICP = "Product and engineering leads at B2B software companies with 10 to 200 employees.";
const COMPETITORS = [
  { name: "Notion", domain: "notion.so" },
  { name: "Linear", domain: "linear.app" },
  { name: "Asana", domain: "asana.com" },
];
const DEALS: { competitorName: string; outcome: "won" | "lost"; reason: string }[] = [
  { competitorName: "Notion", outcome: "lost", reason: "They already used Notion for everything and didn't want another tool." },
  { competitorName: "Notion", outcome: "lost", reason: "Notion's free tier covered the whole team." },
  { competitorName: "Notion", outcome: "won", reason: "Our decision log stays linked to the work, which Notion pages don't do." },
  { competitorName: "Linear", outcome: "lost", reason: "Engineering wanted docs inside their issue tracker." },
  { competitorName: "Linear", outcome: "won", reason: "Non-engineers needed a place for specs that Linear isn't built for." },
  { competitorName: "Asana", outcome: "lost", reason: "Asana was already approved by procurement." },
  { competitorName: "Asana", outcome: "won", reason: "Our search found old decisions in seconds, which Asana couldn't." },
  { competitorName: "Notion", outcome: "lost", reason: "Price: Notion was cheaper per seat for their 40 people." },
];

async function main() {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (list?.users.some((u) => u.email?.toLowerCase() === EMAIL)) {
    throw new Error(`${EMAIL} already exists. Delete that user (and its account) before reseeding.`);
  }

  const password = randomBytes(18).toString("base64url");
  const { data: created, error: userError } = await supabase.auth.admin.createUser({ email: EMAIL, password, email_confirm: true });
  if (userError || !created.user) throw new Error(`createUser failed: ${userError?.message}`);
  const userId = created.user.id;

  const accountId = crypto.randomUUID();
  const { error: accountError } = await supabase.from("accounts").insert({
    id: accountId,
    name: COMPANY,
    tier: "connect",
    status: "active",
    demo_mode: true,
    contact_email: null, // no real mailbox: keeps the weekly, daily and monthly emails from bouncing
    created_by: userId,
    positioning: POSITIONING,
    icp: ICP,
  });
  if (accountError) throw new Error(`account insert failed: ${accountError.message}`);

  const { error: profileError } = await supabase.from("profiles").update({ account_id: accountId }).eq("id", userId);
  if (profileError) throw new Error(`profile link failed: ${profileError.message}`);

  const { error: walletError } = await supabase
    .from("connect_wallets")
    .insert({ account_id: accountId, balance_micros: 100 * 1_000_000, auto_reload_enabled: false });
  if (walletError) console.error("wallet seed failed:", walletError.message);

  writeFileSync("chatgpt-plugin/.reviewer-credentials.local", `email: ${EMAIL}\npassword: ${password}\nlogin: https://www.ripplewatch.ai/login\naccount id: ${accountId}\n`, { mode: 0o600 });
  console.log("account", accountId, "created; credentials saved to chatgpt-plugin/.reviewer-credentials.local");

  for (const c of COMPETITORS) {
    const r = await addCompetitor(supabase as never, accountId, { name: c.name, domain: c.domain, force: true });
    console.log("competitor", c.name, r.ok ? "added" : `FAILED ${r.error}`);
  }
  for (const d of DEALS) {
    const r = await logWinLoss(supabase as never, accountId, d);
    console.log("deal", d.competitorName, d.outcome, r.ok ? "logged" : `FAILED ${r.error}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
