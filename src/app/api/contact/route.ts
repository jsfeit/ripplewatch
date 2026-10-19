import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyLead } from "@/lib/lead-alerts";
import { CONTACT_TOPICS } from "@/lib/contact-topics";

// "Contact us" form: works like a support ticket. It emails the operator
// (reply-to set to the sender) and keeps nothing else.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!checkRateLimit(`contact:${getClientIp(request)}`, 3, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  // Hidden field real visitors never fill in: bots do. Answer as if it worked.
  if (clean(body?.website, 200)) return NextResponse.json({ ok: true });

  const name = clean(body?.name, 120);
  const email = clean(body?.email, 200);
  const company = clean(body?.company, 160);
  const message = clean(body?.message, 4000);
  const topicId = clean(body?.topic, 40);
  const topic = CONTACT_TOPICS.find((t) => t.id === topicId);

  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!topic) return NextResponse.json({ error: "Pick what we can help with." }, { status: 400 });
  if (!topic.messageOptional && message.length < 5) {
    return NextResponse.json({ error: "Tell us a little about what you need." }, { status: 400 });
  }

  await notifyLead({ kind: "contact_request", name, email, company: company || null, topic: topic.label, message });
  return NextResponse.json({ ok: true });
}
