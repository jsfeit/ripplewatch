// What moves together: the customer's own numbers lined up against competitor events.
//
// For each competitor event (a pricing change, a product launch, a funding round) it compares a customer metric in the
// four weeks before with the four weeks after, and asks whether the same competitor's repeated events keep being
// followed by the same kind of change. It reports timing, never cause: a drop after a competitor's price cut is worth a
// look, not a conclusion. Deterministic, no model call, so every sentence can be traced to numbers.
//
// Guards against the usual ways this misleads: a series needs enough points; a metric must actually vary; events within a
// week of each other count once; a window needs points on both sides; one occurrence is only ever "tentative"; and a
// pattern needs the same direction to repeat before it is called more than that.
export type CorrPoint = { metric: string; label: string | null; unit: string | null; segment: string; value: number; period_start: string; higher_is: "better" | "worse" | "neutral" };
export type CorrEvent = { competitor: string; type: string; date: string };

export type Finding = {
  metric: string;
  label: string;
  segment: string;
  competitor: string;
  eventType: string;
  events: number;
  averageChangePct: number;
  verdict: "better" | "worse" | "up" | "down";
  consistency: number; // share of events followed by a change in the same direction
  confidence: "tentative" | "moderate" | "strong";
  sentence: string;
};

const DAY = 86_400_000;
const WINDOW_DAYS = 28;
const MIN_POINTS = 6;
const CLUSTER_DAYS = 7;

const EVENT_WORDS: Record<string, string> = {
  pricing: "pricing change",
  product_change: "product change",
  funding: "funding announcement",
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

function clusterEvents(dates: number[]): number[] {
  const out: number[] = [];
  for (const d of [...dates].sort((a, b) => a - b)) if (out.length === 0 || d - out[out.length - 1] > CLUSTER_DAYS * DAY) out.push(d);
  return out;
}

export function findWhatMovesTogether(points: CorrPoint[], events: CorrEvent[]): Finding[] {
  const series = new Map<string, CorrPoint[]>();
  for (const p of points) {
    const key = `${p.metric}::${p.segment}`;
    series.set(key, [...(series.get(key) ?? []), p]);
  }
  const streams = new Map<string, { competitor: string; type: string; dates: number[] }>();
  for (const e of events) {
    if (!EVENT_WORDS[e.type]) continue;
    const t = new Date(e.date).getTime();
    if (Number.isNaN(t)) continue;
    const key = `${e.competitor}::${e.type}`;
    const s = streams.get(key) ?? { competitor: e.competitor, type: e.type, dates: [] };
    s.dates.push(t);
    streams.set(key, s);
  }

  const findings: Finding[] = [];
  for (const pts of series.values()) {
    if (pts.length < MIN_POINTS) continue;
    const sorted = [...pts].sort((a, b) => a.period_start.localeCompare(b.period_start));
    const values = sorted.map((p) => p.value);
    const spread = std(values);
    if (!(spread > 0)) continue;
    const times = sorted.map((p) => new Date(p.period_start).getTime());
    const latest = times[times.length - 1];
    const head = sorted[0];

    for (const stream of streams.values()) {
      const effects: { z: number; pct: number }[] = [];
      for (const at of clusterEvents(stream.dates)) {
        if (latest < at + 14 * DAY) continue; // not enough time has passed to see an effect
        const before = values.filter((_, i) => times[i] >= at - WINDOW_DAYS * DAY && times[i] < at);
        const after = values.filter((_, i) => times[i] >= at && times[i] < at + WINDOW_DAYS * DAY);
        if (before.length < 2 || after.length < 2) continue;
        const b = mean(before);
        const a = mean(after);
        effects.push({ z: (a - b) / spread, pct: b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0 });
      }
      if (effects.length === 0) continue;

      const medZ = median(effects.map((e) => e.z));
      const sign = Math.sign(medZ);
      if (sign === 0) continue;
      const consistency = effects.filter((e) => Math.sign(e.z) === sign).length / effects.length;
      const n = effects.length;
      let confidence: Finding["confidence"] | null = null;
      if (n >= 5 && Math.abs(medZ) >= 0.8 && consistency >= 0.8) confidence = "strong";
      else if (n >= 3 && Math.abs(medZ) >= 0.6 && consistency >= 0.67) confidence = "moderate";
      else if (n <= 2 && Math.abs(medZ) >= 1.2 && consistency === 1) confidence = "tentative";
      if (!confidence) continue;

      const pct = median(effects.map((e) => e.pct));
      const rose = sign > 0;
      const verdict: Finding["verdict"] = head.higher_is === "neutral" ? (rose ? "up" : "down") : (head.higher_is === "better") === rose ? "better" : "worse";
      const label = head.label || head.metric.replace(/_/g, " ");
      const cohort = head.segment ? ` for ${head.segment.replace(/_/g, " ")}` : "";
      const tail = verdict === "better" ? ", which is the good direction" : verdict === "worse" ? ", which is the wrong direction" : "";
      findings.push({
        metric: head.metric,
        label,
        segment: head.segment,
        competitor: stream.competitor,
        eventType: stream.type,
        events: n,
        averageChangePct: Math.round(pct * 10) / 10,
        verdict,
        consistency: Math.round(consistency * 100) / 100,
        confidence,
        sentence: `After ${stream.competitor}'s ${EVENT_WORDS[stream.type]} (${n} time${n === 1 ? "" : "s"}), your ${label}${cohort} ${rose ? "rose" : "fell"} about ${Math.abs(Math.round(pct))}% over the next four weeks${tail}. ${confidence === "tentative" ? "One or two occurrences, so treat it as a lead to check." : confidence === "moderate" ? "The same direction followed most times." : "The same direction followed nearly every time."} Timing, not proof of cause.`,
      });
    }
  }
  const rank = { strong: 3, moderate: 2, tentative: 1 } as const;
  return findings.sort((a, b) => rank[b.confidence] - rank[a.confidence] || b.events - a.events).slice(0, 8);
}
