// Splits a raw CSV/text paste into header-repeated chunks small enough for
// one LLM extraction call each — shared by every import route that falls
// back to LLM extraction on freeform data (win-loss, and customer-voice's
// NPS/asks imports), so chunk sizing stays consistent instead of each
// route re-deriving its own row budget.
export function chunkCsv(rawText: string, chunkRows: number, maxChunks: number): string[] {
  const lines = rawText.split("\n").filter((l) => l.trim());
  if (lines.length <= 1) return [rawText];
  const [header, ...rows] = lines;
  const chunks: string[] = [];
  for (let i = 0; i < rows.length && chunks.length < maxChunks; i += chunkRows) {
    chunks.push([header, ...rows.slice(i, i + chunkRows)].join("\n"));
  }
  return chunks;
}
