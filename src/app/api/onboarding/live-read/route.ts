import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeDomain, DOMAIN_PATTERN, isBlockedHost } from "@/lib/domain";
import { buildSnapshot } from "@/lib/snapshot";
import { countUnattributedLlmCalls } from "@/lib/usage";

// Same lookup as the free competitor snapshot (pricing page, job board, a
// recent-activity search), read against what the visitor says they sell. Runs
// before signup, so it is anonymous and capped: per visitor below, and per day
// across everyone by the counts here. Past a cap the visitor just skips the
// read and carries on to signup.
export const maxDuration = 120;

// Worst case for the personalized synthesis alone is roughly 150 calls a day.
// The three lookups it sits on top of share the free snapshot tool's own daily
// ceilings (kept in step with src/app/api/snapshot/route.ts), so this flow and
// that tool draw from one pool and cannot together exceed it.
const LIVE_READ_DAILY_CAP = 150;
const SNAPSHOT_DAILY_LLM_CAP = 300;
const SNAPSHOT_DAILY_RESEARCH_CAP = 100;
const SNAPSHOT_DAILY_ACTIVITY_CAP = 250;

async function underCap(fn: string, cap: number): Promise<boolean> {
  const used = await countUnattributedLlmCalls(fn, 24);
  return used === null || used < cap;
}

export async function POST(request: Request) {
  if (!checkRateLimit(`livread:${getClientIp(request)}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "That's a few reads already. Sign up and you can run as many as you like." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const companyName = str(body?.companyName, 80);
  const positioning = str(body?.positioning, 400);
  const icp = str(body?.icp, 400);
  const domain = normalizeDomain(str(body?.domain, 200)).toLowerCase();

  if (positioning.length < 3) {
    return NextResponse.json({ error: "Tell us in a sentence what you sell." }, { status: 400 });
  }
  if (!DOMAIN_PATTERN.test(domain) || isBlockedHost(domain)) {
    return NextResponse.json({ error: "Enter a real competitor domain, like acme.com." }, { status: 400 });
  }

  const [readAllowed, llmAllowed, researchAllowed, activityAllowed] = await Promise.all([
    underCap("generatePersonalRead", LIVE_READ_DAILY_CAP),
    underCap("extractPricingStructure", SNAPSHOT_DAILY_LLM_CAP),
    underCap("researchDomainPublicly", SNAPSHOT_DAILY_RESEARCH_CAP),
    underCap("researchRecentActivity", SNAPSHOT_DAILY_ACTIVITY_CAP),
  ]);
  if (!readAllowed) {
    console.warn(`live read cap (${LIVE_READ_DAILY_CAP}/24h) reached`);
    return NextResponse.json({ read: null, reason: "busy" });
  }

  const result = await buildSnapshot(domain, {
    llmAllowed,
    researchAllowed,
    activityAllowed,
    verdictAllowed: true,
    visitor: { companyName: companyName || null, positioning, icp },
  });

  // Short, honest list of what the read actually drew on, shown under it.
  const evidence: string[] = [];
  if (result.pricing.state === "public") evidence.push("pricing page");
  if (result.pricing.state === "sales_led" || result.pricing.state === "public_no_numbers") evidence.push("pricing page (no public prices)");
  if (result.hiring.status === "ok") evidence.push("job board");
  const news = result.activity?.signals.length ?? 0;
  if (news > 0) evidence.push(`${news} recent news item${news === 1 ? "" : "s"}`);

  return NextResponse.json({
    read: result.personalRead,
    competitor: { domain, name: result.activity?.companyName || result.title || domain },
    evidence,
    reachable: result.reachable,
  });
}
