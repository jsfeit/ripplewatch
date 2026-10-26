import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_LABELS } from "@/lib/audit";
import { loadAuditLog } from "@/lib/audit-read";

// A cell starting with = + - or @ is read as a formula by spreadsheets, so it
// gets a leading apostrophe; the rest is quoted.
function cell(value: string | null | undefined): string {
  const text = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const log = await loadAuditLog(user.id, 50000);
  if (log.state !== "ok") {
    return NextResponse.json({ error: "Only the account owner can export the audit log." }, { status: 403 });
  }

  const lines = [["When (UTC)", "Who", "Type", "Action", "Target", "IP address"].map(cell).join(",")];
  for (const r of log.rows) {
    lines.push(
      [
        r.created_at,
        r.actor_label ?? "",
        r.actor_type,
        AUDIT_LABELS[r.action as keyof typeof AUDIT_LABELS] ?? r.action,
        r.target ?? "",
        r.ip ?? "",
      ]
        .map(cell)
        .join(",")
    );
  }
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ripplewatch-audit-log.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
