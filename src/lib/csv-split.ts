// Splits a CSV into batches of whole records, with the header repeated on each. Quote-aware, so a
// reason with a line break inside quotes is never cut in half. No dependencies, so the browser can use
// it: a large export is sent in batches rather than one request.
export function splitCsvIntoBatches(text: string, rowsPerBatch: number): { totalRows: number; batches: string[] } {
  const clean = text.replace(/^﻿/, "");
  const records: string[] = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') inQuotes = !inQuotes;
    else if ((c === "\n" || c === "\r") && !inQuotes) {
      const rec = clean.slice(start, i);
      if (rec.trim() !== "") records.push(rec);
      if (c === "\r" && clean[i + 1] === "\n") i++;
      start = i + 1;
    }
  }
  const last = clean.slice(start);
  if (last.trim() !== "") records.push(last);

  const [header, ...rows] = records;
  if (header === undefined) return { totalRows: 0, batches: [] };
  const batches: string[] = [];
  for (let i = 0; i < rows.length; i += rowsPerBatch) batches.push([header, ...rows.slice(i, i + rowsPerBatch)].join("\n"));
  return { totalRows: rows.length, batches };
}
