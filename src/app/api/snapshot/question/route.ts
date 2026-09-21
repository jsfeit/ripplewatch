import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendSnapshotQuestionEmail } from "@/lib/resend";
import { OPERATOR_EMAIL } from "@/lib/followups";

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: a visitor on the competitor-snapshot page asking us something. Lands
// in the same inbox as in-app feedback, replyTo set to them.
export async function POST(request: Request) {
  if (!checkRateLimit(`snapshot-question:${getClientIp(request)}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a bit." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const domain = typeof body?.domain === "string" ? body.domain.trim().slice(0, 200) : null;

  if (!VALID_EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Type your question first." }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Keep it under 2,000 characters." }, { status: 400 });

  try {
    await sendSnapshotQuestionEmail([OPERATOR_EMAIL], { fromEmail: email, domain, message });
  } catch (err) {
    console.error("snapshot question email failed:", err);
    return NextResponse.json({ error: "Couldn't send that. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
