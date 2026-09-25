import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Collects the LLM cost of everything that runs inside one metered operation
// (an MCP tool call), without threading a cost value back through every
// function in between. recordLlmUsage reports each call's cost here; a caller
// wraps the work in runMetered and reads the total afterward.
const store = new AsyncLocalStorage<{ costUsd: number }>();

export function addMeteredCost(costUsd: number): void {
  const current = store.getStore();
  if (current && Number.isFinite(costUsd)) current.costUsd += costUsd;
}

export async function runMetered<T>(fn: () => Promise<T>): Promise<{ result: T; costUsd: number }> {
  const meter = { costUsd: 0 };
  const result = await store.run(meter, fn);
  return { result, costUsd: meter.costUsd };
}
