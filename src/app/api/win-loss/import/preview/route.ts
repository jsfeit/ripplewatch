import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/route-account";
import { buildPreview, previewDealImport } from "@/lib/deal-ingest";
import { parseDealTable, type DealColumnMapping } from "@/lib/deal-csv";
import { parseMapping } from "@/lib/deal-mapping-input";

export const maxDuration = 60;

// Step one of an import: say how the file was read, write nothing. Send { text } to let Ripplewatch work
// out the columns, or { text, mapping } to re-run with the user's corrections.
export async function POST(request: Request) {
  const auth = await requireAccount();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const text: string = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ error: "No data to import." }, { status: 400 });

  if (body?.mapping) {
    const table = parseDealTable(text);
    const mapping: DealColumnMapping | null = parseMapping(body.mapping, table.header);
    if (!mapping) return NextResponse.json({ error: "That column mapping was not valid." }, { status: 400 });
    return NextResponse.json(buildPreview(table, mapping, false));
  }

  const preview = await previewDealImport(text, auth.accountId);
  if ("error" in preview) return NextResponse.json({ error: preview.error }, { status: 400 });
  return NextResponse.json(preview);
}
