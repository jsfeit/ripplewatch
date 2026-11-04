import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { error } = await auth.supabase.from("context_notes").delete().eq("id", id).eq("account_id", auth.accountId);
  if (error) return NextResponse.json({ error: "Could not delete that note." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
