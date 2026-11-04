import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { addContextNote, listContextNotes } from "@/lib/context-notes";

export const maxDuration = 60;

export async function GET() {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ notes: await listContextNotes(auth.supabase, auth.accountId) });
}

export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body : "";
  const effectiveOn = typeof body?.effectiveOn === "string" ? body.effectiveOn : null;
  const added = await addContextNote(auth.supabase, auth.accountId, auth.userId, { body: text, effectiveOn, source: "web" });
  if (!added.ok) return NextResponse.json({ error: added.error }, { status: 400 });
  return NextResponse.json({ note: added.note });
}
