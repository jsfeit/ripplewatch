// Shared by every Admin list page that shows a stable "#N" ordinal (oldest
// = 1) next to a row — a simple human-referenceable number distinct from
// whatever order the list itself is sorted in, computed from a timestamp
// already on the row rather than a new database column.
export function buildOrdinalMap<T>(
  rows: T[],
  getId: (row: T) => string,
  getSortKey: (row: T) => string
): Map<string, number> {
  const sorted = [...rows].sort((a, b) => new Date(getSortKey(a)).getTime() - new Date(getSortKey(b)).getTime());
  const map = new Map<string, number>();
  for (const [index, row] of sorted.entries()) {
    map.set(getId(row), index + 1);
  }
  return map;
}
