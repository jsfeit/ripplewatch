import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, matches the onboarding document upload limit

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const resume = formData.get("resume");

  if (!name || !email || !jobTitle) {
    return NextResponse.json({ error: "Name, email, and job title are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!(resume instanceof File)) {
    return NextResponse.json({ error: "A resume file is required." }, { status: 400 });
  }
  if (resume.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Resume must be under 10MB." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const storagePath = `${Date.now()}-${crypto.randomUUID()}-${resume.name}`;

  const { error: uploadError } = await supabase.storage
    .from("career-resumes")
    .upload(storagePath, resume, { contentType: resume.type || "application/octet-stream" });

  if (uploadError) {
    return NextResponse.json({ error: "Could not upload resume. Try again." }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("career_applications").insert({
    name,
    email,
    job_title: jobTitle,
    resume_file_name: resume.name,
    resume_storage_path: storagePath,
  });

  if (insertError) {
    console.error("career application insert failed:", insertError);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
