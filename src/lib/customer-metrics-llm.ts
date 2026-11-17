import "server-only";
import { cachedSystemPrompt, createMessage } from "@/lib/anthropic";
import { recordLlmUsage } from "@/lib/usage";
import { monthStart, type MetricPeriod } from "@/lib/customer-metrics";

const MODEL = "claude-sonnet-5";
export const MAX_METRIC_PERIODS = 60;
const MAX_INPUT_CHARS = 20000;

const systemPrompt = (today: string) => `You read churn and growth numbers a company pasted in, in any layout: a spreadsheet export, a table copied from a dashboard, a billing report, or plain sentences. Return one row per month. Today's date is ${today}.

For each month give, when the data has it (otherwise null):
- month: YYYY-MM. If a month has no year, use the most recent past occurrence of that month, never a future date and never an older year. If the data has weekly or daily rows, add them up into months only when that is straightforward; otherwise skip those rows.
- customersStart: customers or subscribers at the start of the month.
- newCustomers: new customers that month.
- cancelledCustomers: customers who cancelled or churned that month.
- customersEnd: customers at the end of the month.
- revenue: revenue (MRR, revenue or sales) for the month, as a plain number.
- churnPct: churn rate for the month as a percentage from 0 to 100, ONLY if the data states a churn rate. Do not compute it yourself, and never put a fraction here: 0.05 means 0.05%, so if the data shows 5% or 0.05 meaning five percent, return 5.

Never invent a number. A value you cannot find is null, and null is not 0: only return 0 when the data says zero. If the rows are individual customers rather than monthly figures, return no rows at all. Ignore totals and averages rows.

Respond with JSON only, matching the schema.`;

const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };

const SCHEMA = {
  type: "object",
  properties: {
    periods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          month: { type: "string" },
          customersStart: nullableNumber,
          newCustomers: nullableNumber,
          cancelledCustomers: nullableNumber,
          customersEnd: nullableNumber,
          revenue: nullableNumber,
          churnPct: nullableNumber,
        },
        required: ["month", "customersStart", "newCustomers", "cancelledCustomers", "customersEnd", "revenue", "churnPct"],
        additionalProperties: false,
      },
    },
  },
  required: ["periods"],
  additionalProperties: false,
} as const;

function count(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
}
function amount(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}
function pct(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
}

// Cleans whatever the model (or a caller) hands back into valid periods: one per month, numbers
// checked, nothing invented. Shared with the assistant tool, which passes rows in directly.
export function cleanPeriods(raw: unknown): MetricPeriod[] {
  const byMonth = new Map<string, MetricPeriod>();
  const thisMonth = new Date().toISOString().slice(0, 7) + "-01";
  for (const item of Array.isArray(raw) ? raw : []) {
    const month = typeof item?.month === "string" ? monthStart(item.month) : typeof item?.periodStart === "string" ? monthStart(item.periodStart) : null;
    if (!month) continue;
    // A month in the future cannot be data.
    if (month > thisMonth) continue;
    // A company with zero customers at the start or end of a month is not a real reading: it is a
    // missing value, and 0 here would turn a gap into a made-up rate.
    const positive = (v: unknown) => {
      const n = count(v);
      return n !== null && n > 0 ? n : null;
    };
    let customersStart = positive(item.customersStart);
    const cancelled = count(item.cancelledCustomers);
    // More cancellations than customers at the start is not possible: the start figure is wrong.
    if (customersStart !== null && cancelled !== null && cancelled > customersStart) customersStart = null;
    const period: MetricPeriod = {
      periodStart: month,
      customersStart,
      newCustomers: count(item.newCustomers),
      cancelledCustomers: cancelled,
      customersEnd: positive(item.customersEnd),
      revenue: amount(item.revenue),
      churnPct: pct(item.churnPct),
    };
    const hasAny = [period.customersStart, period.newCustomers, period.cancelledCustomers, period.customersEnd, period.revenue, period.churnPct].some((v) => v !== null);
    if (hasAny) byMonth.set(month, period);
  }
  return [...byMonth.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart)).slice(-MAX_METRIC_PERIODS);
}

export async function extractMetricPeriods(text: string, accountId: string | null): Promise<MetricPeriod[]> {
  const message = await createMessage({
    model: MODEL,
    max_tokens: 4096,
    system: cachedSystemPrompt(systemPrompt(new Date().toISOString().slice(0, 10))),
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: text.slice(0, MAX_INPUT_CHARS) }],
  });
  recordLlmUsage(accountId, "extractMetricPeriods", message.model, message.usage);
  const raw = message.content.find((b) => b.type === "text")?.text ?? "{}";
  try {
    return cleanPeriods((JSON.parse(raw) as { periods?: unknown }).periods);
  } catch {
    return [];
  }
}
