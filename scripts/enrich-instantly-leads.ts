// One-off: reads each uncontacted cold-email lead's own website with the
// competitor-snapshot pipeline and writes a one-line "Finding" per lead to a
// local JSON file, for the offer test. Writes nothing to Instantly or the app
// database. Only reads the site directly (no web-research fallback), so a
// Finding is never a guess.
//
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 \   # keeps this batch out of llm_usage
//   node --conditions=react-server --env-file=.env.local --import tsx \
//     scripts/enrich-instantly-leads.ts /tmp/instantly_leads.json /tmp/findings.json
import { readFileSync, writeFileSync } from "node:fs";
import { buildSnapshot, type SnapshotResult } from "@/lib/snapshot";
import { withTimeout } from "@/lib/scraping";

type Lead = { id: string; email: string; company_domain: string | null; timestamp_last_contact: string | null };
type Out = { id: string; domain: string; finding: string | null; why: string; pricing: string; roles: number | null };

const [inPath, outPath] = process.argv.slice(2);
const CONCURRENCY = Number(process.env.ENRICH_CONCURRENCY ?? 5);
const PER_LEAD_MS = 75_000;

function money(price: number, period: string | null): string {
  return `$${price}${period ? `/${period}` : ""}`;
}

// null when there's nothing solid to say. Pricing counts only from a live
// read (an archived copy may be stale); hiring only when a job list was read.
export function composeFinding(r: SnapshotResult): { finding: string | null; why: string } {
  if (r.reachability !== "ok") return { finding: null, why: `site ${r.reachability}` };
  const parts: string[] = [];
  if (r.pricing.source === "live") {
    if (r.pricing.state === "public") {
      const priced = r.pricing.tiers.filter((t) => t.price !== null);
      const paid = priced.filter((t) => (t.price ?? 0) > 0).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      const hasFree = priced.some((t) => t.price === 0);
      if (paid[0]) {
        parts.push(
          `${hasFree ? "You have a free plan, and paid plans start" : "Your pricing starts"} at ${money(paid[0].price!, paid[0].price_period)}`
        );
      } else if (hasFree) {
        parts.push("Your pricing page shows a free plan");
      }
    } else if (r.pricing.state === "sales_led") {
      parts.push("You don't publish prices, so anyone comparing you has to talk to sales first");
    }
  }
  if (r.hiring.status === "ok" && r.hiring.openRoles > 0) {
    const top = r.hiring.departments[0];
    const roles = `${r.hiring.openRoles} open role${r.hiring.openRoles === 1 ? "" : "s"}`;
    const mix = top && r.hiring.openRoles > 1 ? `, mostly ${top.name.toLowerCase()}` : "";
    parts.push(parts.length ? `you have ${roles}${mix}` : `You have ${roles}${mix}`);
  }
  if (parts.length === 0) return { finding: null, why: "nothing read directly" };
  return { finding: parts.join(", and ") + ".", why: "ok" };
}

async function main() {
  const leads = (JSON.parse(readFileSync(inPath, "utf8")) as Lead[]).filter((l) => !l.timestamp_last_contact && l.company_domain);
  const results: Out[] = [];
  let next = 0;
  async function worker() {
    while (next < leads.length) {
      const lead = leads[next++];
      const domain = lead.company_domain!.toLowerCase();
      const r = await withTimeout(buildSnapshot(domain, { llmAllowed: true, researchAllowed: false }), PER_LEAD_MS);
      const out: Out = r
        ? { id: lead.id, domain, ...composeFinding(r), pricing: r.pricing.state, roles: r.hiring.status === "ok" ? r.hiring.openRoles : null }
        : { id: lead.id, domain, finding: null, why: "timed out", pricing: "-", roles: null };
      results.push(out);
      writeFileSync(outPath, JSON.stringify(results, null, 1));
      console.log(`${results.length}/${leads.length} ${domain}: ${out.finding ?? `(none: ${out.why})`}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const good = results.filter((r) => r.finding).length;
  console.log(`\nDone. ${good}/${results.length} leads have a Finding.`);
}

void main();
