import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: doc } = await supabase
    .from("account_documents")
    .select("storage_path")
    .eq("id", id)
    .eq("uploaded_by", user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await supabase.storage.from("account-documents").remove([doc.storage_path]);
  await supabase.from("account_documents").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
