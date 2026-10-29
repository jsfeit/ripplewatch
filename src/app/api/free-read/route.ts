import { NextResponse, after } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeDomain, DOMAIN_PATTERN, isBlockedHost } from "@/lib/domain";
import { buildSnapshot, describePricingForVerdict, describeHiringForVerdict, type SnapshotResult } from "@/lib/snapshot";
import { generateFreeRead, type FreeRead } from "@/lib/anthropic";
import { countUnattributedLlmCalls } from "@/lib/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyLead } from "@/lib/lead-alerts";
import { sendCampaignEmail } from "@/lib/resend";

// The deeper free read: up to three competitors, read against what the visitor sells, ranked
// heating up or cooling off, with a year of pricing history. Runs before signup, so it is gated
// by an email, per-visitor limits and a daily cap. The response is a stream of JSON lines so the
// page can show the read being built instead of a spinner.
export const maxDuration = 120;

// Each read is up to three lookups at roughly $0.10 to $0.15 each plus one synthesis call, so
// 40 reads a day is a worst case of about $20. The lookups underneath share the free snapshot
// tool's own daily ceilings (see src/app/api/snapshot/route.ts) and cannot together exceed them.
const FREE_READ_DAILY_CAP = 40;
const SNAPSHOT_DAILY_LLM_CAP = 300;
const SNAPSHOT_DAILY_RESEARCH_CAP = 100;
const SNAPSHOT_DAILY_ACTIVITY_CAP = 250;
const MAX_COMPETITORS = 3;

// Throwaway inboxes. Free mail like gmail is allowed: plenty of one-person companies use it.
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com",
  "trashmail.com", "sharklasers.com", "getnada.com", "throwawaymail.com", "dispostable.com", "maildrop.cc",
]);

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function underCap(fn: string, cap: number): Promise<boolean> {
  const used = await countUnattributedLlmCalls(fn, 24);
  return used === null || used < cap;
}

type CompetitorCard = {
  domain: string;
  name: string;
  evidence: string[];
  pricing: { state: SnapshotResult["pricing"]["state"]; from: string | null };
  openRoles: number | null;
  newsCount: number;
  history: { capturedAt: string; changed: boolean; summary: string } | null;
};

function describeBackup(b: SnapshotResult["backup"]): string {
  if (!b) return "";
  const lines: string[] = [];
  if (b.positioning) {
    lines.push(
      b.positioning.changed
        ? `Homepage message vs an archived copy from ${b.positioning.capturedAt}: ${b.positioning.summary}`
        : `Homepage message vs an archived copy from ${b.positioning.capturedAt}: no meaningful change.`
    );
  }
  if (b.buzz) {
    lines.push(`Reddit and Hacker News, ${b.buzz.mentions} recent mention${b.buzz.mentions === 1 ? "" : "s"}${b.buzz.summary ? `: ${b.buzz.summary}` : "."}`);
  }
  return lines.join("\n");
}

function toCard(domain: string, r: SnapshotResult): CompetitorCard {
  const evidence: string[] = [];
  if (r.pricing.state === "public") evidence.push("pricing page");
  if (r.pricing.state === "sales_led" || r.pricing.state === "public_no_numbers") evidence.push("pricing page (no public prices)");
  if (r.hiring.status === "ok") evidence.push("job board");
  const newsCount = r.activity?.signals.length ?? 0;
  if (newsCount > 0) evidence.push(`${newsCount} recent news item${newsCount === 1 ? "" : "s"}`);
  if (r.pricingHistory) evidence.push("pricing history");
  if (r.backup?.positioning) evidence.push("homepage history");
  if (r.backup?.buzz) evidence.push("Reddit and Hacker News");
  const cheapest = r.pricing.tiers.find((t) => t.price !== null);
  return {
    domain,
    name: r.activity?.companyName || r.title || domain,
    evidence,
    pricing: {
      state: r.pricing.state,
      from: cheapest ? `$${cheapest.price}${cheapest.price_period ? `/${cheapest.price_period}` : ""}` : null,
    },
    openRoles: r.hiring.status === "ok" ? r.hiring.openRoles : null,
    newsCount,
    history: r.pricingHistory ?? null,
  };
}

function describeHistory(h: SnapshotResult["pricingHistory"]): string {
  if (!h) return "No archived copy from about a year ago to compare with.";
  if (!h.changed) return `Compared with an archived copy from ${h.capturedAt}: no meaningful change.`;
  return `Compared with an archived copy from ${h.capturedAt}: ${h.summary}`;
}

function emailHtml(company: string, read: FreeRead, cards: CompetitorCard[], appUrl: string, leadId: string | null): string {
  const label: Record<string, string> = { heating_up: "Heating up", cooling_off: "Cooling off", steady: "Holding steady", unclear: "Not enough to tell" };
  const rows = read.competitors
    .map((c) => {
      const card = cards.find((x) => x.domain === c.domain);
      return `<p style="margin:16px 0 0"><strong>${escapeHtml(card?.name ?? c.domain)}: ${label[c.trend]}</strong><br>${escapeHtml(c.headline)}<br><span style="color:#555">What changed: ${escapeHtml(c.changed)}</span><br><span style="color:#555">${escapeHtml(c.matters)}</span></p>`;
    })
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#111">
<p>Here's the read you asked for${company ? ` for ${escapeHtml(company)}` : ""}.</p>${rows}
<p style="margin:20px 0 0"><strong>What you could do:</strong> ${escapeHtml(read.move)}</p>
<p><strong>Worth answering from your own deals:</strong> ${escapeHtml(read.question)}</p>
<p style="color:#555">That was one look. Ripplewatch keeps watching, scores every move against your deals, and answers in Claude or ChatGPT: <a href="${appUrl}/pricing">${appUrl.replace(/^https?:\/\//, "")}/pricing</a>.</p>
${leadId ? `<p style="color:#888;font-size:12px">Questions? Just reply, a person reads every one.<br><a href="${appUrl}/unsubscribe?lead=${leadId}" style="color:#888">Unsubscribe from follow-up emails</a></p>` : ""}
</div>`;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const body = await request.json().catch(() => null);
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const email = str(body?.email, 200).toLowerCase();
  const companyName = str(body?.companyName, 80);
  const positioning = str(body?.positioning, 400);
  const icp = str(body?.icp, 400);
  const utmSource = str(body?.utm_source, 100);
  const utmMedium = str(body?.utm_medium, 100);
  const utmCampaign = str(body?.utm_campaign, 100);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || DISPOSABLE.has(email.split("@")[1])) {
    return NextResponse.json({ error: "Enter the email you'd like the read sent to." }, { status: 400 });
  }
  if (positioning.length < 3) {
    return NextResponse.json({ error: "Tell us in a sentence what you sell." }, { status: 400 });
  }
  const rawDomains: unknown[] = Array.isArray(body?.domains) ? body.domains : [];
  const domains = [...new Set(rawDomains.map((d) => normalizeDomain(str(d, 200)).toLowerCase()).filter(Boolean))].slice(0, MAX_COMPETITORS);
  if (domains.length === 0 || domains.some((d) => !DOMAIN_PATTERN.test(d) || isBlockedHost(d))) {
    return NextResponse.json({ error: "Enter real competitor domains, like acme.com." }, { status: 400 });
  }

  if (!checkRateLimit(`freeread-ip:${ip}`, 3, 60 * 60_000) || !checkRateLimit(`freeread-email:${email}`, 2, 24 * 60 * 60_000)) {
    return NextResponse.json({ error: "That's a few reads already. Sign up and you can run as many as you like." }, { status: 429 });
  }

  const [readAllowed, llmAllowed, researchAllowed, activityAllowed] = await Promise.all([
    underCap("generateFreeRead", FREE_READ_DAILY_CAP),
    underCap("extractPricingStructure", SNAPSHOT_DAILY_LLM_CAP),
    underCap("researchDomainPublicly", SNAPSHOT_DAILY_RESEARCH_CAP),
    underCap("researchRecentActivity", SNAPSHOT_DAILY_ACTIVITY_CAP),
  ]);
  if (!readAllowed) {
    console.warn(`free read cap (${FREE_READ_DAILY_CAP}/24h) reached`);
    return NextResponse.json({ error: "The free reads are busy today. Try again tomorrow, or sign up and ask directly.", reason: "busy" }, { status: 503 });
  }

  const admin = createAdminClient();

  // The email is the price of the read, so it is recorded before any money is spent on it.
  const { data: insertedLead, error: leadError } = await admin
    .from("leads")
    .insert({
    email,
    company_name: companyName || null,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    capture_point: "free_read",
    metadata: { positioning, icp, competitors: domains.join(", ") },
    })
    .select("id")
    .single();
  if (leadError && leadError.code !== "23505") console.error("free read lead insert failed:", leadError.message);
  const newLead = !leadError;
  // Someone who already left their email (quiz, snapshot) has a lead row; the unsubscribe link needs its id.
  let leadId: string | null = insertedLead?.id ?? null;
  if (!leadId) {
    const { data: existing } = await admin.from("leads").select("id").eq("email", email).maybeSingle();
    leadId = existing?.id ?? null;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        send({ t: "start", domains });
        const results = await Promise.all(
          domains.map(async (domain) => {
            const r = await buildSnapshot(domain, {
              llmAllowed,
              researchAllowed,
              activityAllowed,
              verdictAllowed: false,
              history: true,
              onStep: (step) => send({ t: "step", domain, step }),
            });
            const card = toCard(domain, r);
            send({ t: "competitor", card });
            return { r, card };
          })
        );

        send({ t: "writing" });
        const read = await generateFreeRead({
          visitorCompany: companyName || null,
          visitorPositioning: positioning,
          visitorIcp: icp,
          competitors: results.map(({ r, card }) => ({
            domain: card.domain,
            name: card.name,
            pricingSummary: describePricingForVerdict(r.pricing),
            pricingHistory: describeHistory(r.pricingHistory ?? null),
            hiringSummary: describeHiringForVerdict(r.hiring),
            otherEvidence: describeBackup(r.backup),
            activitySignals: r.activity?.signals ?? [],
          })),
        });
        if (!read) {
          send({ t: "error", message: "I couldn't put a read together from that. Try different competitors, or sign up and ask directly." });
          return;
        }

        const cards = results.map((x) => x.card);
        let readId: string | null = null;
        const { data: saved, error: saveError } = await admin
          .from("live_reads")
          .insert({
            company_name: companyName || null,
            positioning,
            icp: icp || null,
            competitor_domain: domains[0],
            competitor_name: cards[0]?.name ?? domains[0],
            evidence: cards.flatMap((c) => c.evidence.map((e) => `${c.name}: ${e}`)),
            read: {
              kind: "free_read",
              email,
              cards,
              analysis: read,
              // The admin live-reads page shows these four, so a deep read still reads sensibly there.
              found: read.competitors.map((c) => `${cards.find((x) => x.domain === c.domain)?.name ?? c.domain}: ${c.headline}`).join(" "),
              meaning: read.watchFirst.reason,
              move: read.move,
              question: read.question,
            } as unknown as Record<string, unknown>,
            utm_source: utmSource || null,
            utm_medium: utmMedium || null,
            utm_campaign: utmCampaign || null,
          })
          .select("id")
          .single();
        if (saveError) console.error("free read not saved:", saveError.message);
        else readId = saved.id;

        send({ t: "read", read, readId });

        after(async () => {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ripplewatch.ai";
          try {
            await sendCampaignEmail(email, "Your competitor read from Ripplewatch", emailHtml(companyName, read, cards, appUrl, leadId));
          } catch (err) {
            console.error("free read email failed:", err instanceof Error ? err.message : err);
          }
          if (newLead) {
            await notifyLead({
              kind: "lead_captured",
              email,
              source: "free_read",
              company: companyName || null,
              utmSource: utmSource || null,
              utmMedium: utmMedium || null,
              utmCampaign: utmCampaign || null,
              detail: `read ${domains.join(", ")}`,
            });
          }
        });
      } catch (err) {
        console.error("free read failed:", err);
        send({ t: "error", message: "Something went wrong running that. Try again in a minute." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
