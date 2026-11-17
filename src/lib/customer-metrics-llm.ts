import "server-only";
import { cachedSystemPrompt, createMessage } from "@/lib/anthropic";
import { recordLlmUsage } from "@/lib/usage";
import { monthStart, type MetricPeriod } from "@/lib/customer-metrics";

const MODEL = "claude-sonnet-5";
export const MAX_METRIC_PERIODS = 60;
const MAX_INPUT_CHARS = 20000;

const SYSTEM_PROMPT = `You read churn and growth numbers a company pasted in, in any layout: a spreadsheet export, a table copied from a dashboard, a billing report, or plain sentences. Return one row per month.

For each month give, when the data has it (otherwise null):
- month: YYYY-MM. If the data has weekly or daily rows, add them up into months only when that is straightforward; otherwise skip those rows.
- customersStart: customers or subscribers at the start of the month.
- newCustomers: new customers that month.
- cancelledCustomers: customers who cancelled or churned that month.
- customersEnd: customers at the end of the month.
- revenue: revenue (MRR, revenue or sales) for the month, as a plain number.
- churnPct: churn rate for the month as a percentage from 0 to 100, ONLY if the data states a churn rate. Do not compute it yourself, and never put a fraction here: 0.05 means 0.05%, so if the data shows 5% or 0.05 meaning five percent, return 5.

Never invent a number. A value you cannot find is null. Ignore totals and averages rows.

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
  for (const item of Array.isArray(raw) ? raw : []) {
    const month = typeof item?.month === "string" ? monthStart(item.month) : typeof item?.periodStart === "string" ? monthStart(item.periodStart) : null;
    if (!month) continue;
    const period: MetricPeriod = {
      periodStart: month,
      customersStart: count(item.customersStart),
      newCustomers: count(item.newCustomers),
      cancelledCustomers: count(item.cancelledCustomers),
      customersEnd: count(item.customersEnd),
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
    system: cachedSystemPrompt(SYSTEM_PROMPT),
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
