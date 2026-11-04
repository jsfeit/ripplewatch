import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { commitDealImport } from "@/lib/deal-ingest";
import { parseDealTable } from "@/lib/deal-csv";
import { parseMapping } from "@/lib/deal-mapping-input";

// A big export reads thousands of rows; this keeps it from being cut off mid-write.
export const maxDuration = 300;

// Step two: the user confirmed (or corrected) the column mapping from the preview.
export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const text: string = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ error: "No data to import." }, { status: 400 });
  const table = parseDealTable(text);
  const mapping = parseMapping(body?.mapping, table.header);
  if (!mapping) return NextResponse.json({ error: "That column mapping was not valid." }, { status: 400 });
  const filename = typeof body?.filename === "string" ? body.filename.slice(0, 200) : null;

  const summary = await commitDealImport(auth.supabase, auth.accountId, auth.userId, text, mapping, { source: "csv", filename });
  return NextResponse.json(summary);
}
