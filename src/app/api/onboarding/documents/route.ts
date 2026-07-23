import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — plenty for notes/decks, not video

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("account_documents")
    .select("*")
    .eq("uploaded_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}

// Stores the file only — nothing here parses it into scoring context yet.
// That's a deliberate follow-up, not an oversight: summarizing/parsing
// arbitrary uploaded docs into the Claude prompt needs its own scoping pass
// (size limits are already tight here, but token cost and file-type handling
// are a separate decision).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be under 10MB." }, { status: 400 });
  }

  const storagePath = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("account-documents")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("account_documents")
    .insert({
      uploaded_by: user.id,
      file_name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}
