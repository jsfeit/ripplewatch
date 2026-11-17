import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseWebsite, readCompanyWebsite } from "@/lib/company-overview";

// Reads the company's own website and returns a short overview, a guess at whether it sells to
// businesses, consumers or both, and a suggested positioning and customer line. Nothing here
// overwrites what the customer typed: the screen decides what to fill. The website and overview
// are saved on the account so a reload shows them again.
export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;

  if (!checkRateLimit(`company-overview:${auth.accountId}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "That's a lot of lookups. Try again in a few minutes." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const website = typeof body?.website === "string" ? body.website : "";
  const host = parseWebsite(website);
  if (!host) {
    return NextResponse.json({ error: "Enter your website as a domain, like acme.com." }, { status: 400 });
  }

  const { data: account } = await auth.supabase.from("accounts").select("name").eq("id", auth.accountId).single();
  if (!account) return NextResponse.json({ error: "No account." }, { status: 400 });

  const found = await readCompanyWebsite(account.name, host, auth.accountId);
  // Keep the website even when it could not be read: it still sharpens the later research.
  await auth.supabase
    .from("accounts")
    .update({ website: host, ...(found ? { company_overview: found.overview } : {}) })
    .eq("id", auth.accountId);

  if (!found) {
    return NextResponse.json({ error: "I couldn't read that site. You can describe the business below instead." }, { status: 422 });
  }
  return NextResponse.json({ overview: found });
}
