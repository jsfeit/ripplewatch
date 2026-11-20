// The one-line answer to "who's heating up?", written once on the server so the card and the assistant say the same thing.
//
// It leads with a real finding when there is one (a competitor clearly heating up on a full-confidence read), and
// otherwise says plainly that nobody is yet and names who to watch and why. Early reads (under about a month of history)
// are never presented as findings. Entries that are not companies are ignored. Pure and the same for every account.
export type VerdictCompetitor = {
  name: string;
  label: string; // the Momentum label: Heating up, Steady, Cooling, Gone quiet, Not enough history yet
  confidence: string; // "full" | "low"
  priority: number;
  reasons: string[];
  looksWrong: boolean;
};
export type Verdict = { headline: string; detail: string | null; watch: string | null; early: boolean };

const WATCH_FLOOR = 35;
const join = (list: string[]) => (list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

export function momentumVerdict(all: VerdictCompetitor[]): Verdict {
  const real = all.filter((c) => !c.looksWrong);
  if (all.length === 0) return { headline: "No competitors are tracked yet.", detail: null, watch: null, early: false };
  if (real.length === 0) return { headline: "Nothing real to compare yet.", detail: "The only entries look like headlines, not companies. Remove or rename them in Settings.", watch: null, early: false };

  const byPriority = [...real].sort((a, b) => b.priority - a.priority);
  const top = byPriority[0];
  const early = !real.some((c) => c.confidence === "full");
  const heating = real.filter((c) => c.label === "Heating up" && c.confidence === "full");
  const why = (c: VerdictCompetitor) => c.reasons.slice(0, 2).join("; ");

  if (heating.length > 0) {
    const names = heating.map((c) => c.name);
    return {
      headline: `${join(names)} ${names.length === 1 ? "is" : "are"} heating up.`,
      detail: why(heating[0]) ? `Why: ${why(heating[0])}.` : null,
      watch: heating[0].name,
      early: false,
    };
  }

  const detail =
    top.priority >= WATCH_FLOOR
      ? `Watch ${top.name}${why(top) ? `: ${why(top)}` : ""}.${early ? " These are early reads, from under a month of history." : ""}`
      : `Nothing stands out yet.${early ? " Ripplewatch is still building a baseline, so these are early reads." : ""}`;
  return { headline: "Nobody is clearly heating up yet.", detail, watch: top.priority >= WATCH_FLOOR ? top.name : null, early };
}
