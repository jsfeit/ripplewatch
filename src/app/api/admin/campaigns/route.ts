import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSegmentLeads, type CampaignSegment } from "@/lib/campaigns";

const VALID_SEGMENTS: CampaignSegment[] = ["waitlist_not_signed_up"];

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const segment = body?.segment;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const bodyHtml = typeof body?.body === "string" ? body.body.trim() : "";

  if (!name || !subject || !bodyHtml) {
    return NextResponse.json({ error: "Name, subject, and body are required." }, { status: 400 });
  }
  if (!VALID_SEGMENTS.includes(segment)) {
    return NextResponse.json({ error: "Invalid segment." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_campaigns")
    .insert({ name, segment, subject, body: bodyHtml })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = await getSegmentLeads(segment);
  return NextResponse.json({ campaign: data, audienceCount: leads.length });
}
