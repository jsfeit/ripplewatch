import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildScoringUserPrompt,
  parseScoringText,
  scoringRequestParams,
  type ScoringContext,
  type ScoringResult,
  type SignalToScore,
} from "@/lib/anthropic";

let cachedClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!cachedClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

// Batch scoring for the eval set / prompt-regression workflow — not the live
// crawl. Batches run at 50% of standard per-token cost, but aren't instant
// (usually well under an hour, up to 24), which is fine for "score these 40
// known signals and diff against last time" but wrong for "push a Slack
// alert the moment a High signal is detected." Keep those paths separate.
export type ScoringBatchItem = {
  customId: string;
  context: ScoringContext;
  signal: SignalToScore;
};

export async function createScoringBatch(items: ScoringBatchItem[]): Promise<string> {
  const batch = await getAnthropic().messages.batches.create({
    requests: items.map((item) => ({
      custom_id: item.customId,
      params: scoringRequestParams(item.context, item.signal),
    })),
  });
  return batch.id;
}

export type ScoringBatchStatus = {
  processingStatus: string;
  counts: { processing: number; succeeded: number; errored: number; canceled: number; expired: number };
};

export async function getScoringBatchStatus(batchId: string): Promise<ScoringBatchStatus> {
  const batch = await getAnthropic().messages.batches.retrieve(batchId);
  return {
    processingStatus: batch.processing_status,
    counts: {
      processing: batch.request_counts.processing,
      succeeded: batch.request_counts.succeeded,
      errored: batch.request_counts.errored,
      canceled: batch.request_counts.canceled,
      expired: batch.request_counts.expired,
    },
  };
}

export type ScoringBatchResult =
  | { customId: string; status: "succeeded"; result: ScoringResult }
  | { customId: string; status: "errored" | "canceled" | "expired"; error: string };

// Only call once getScoringBatchStatus(...).processingStatus === "ended" —
// results() throws on a batch that's still processing.
export async function getScoringBatchResults(batchId: string): Promise<ScoringBatchResult[]> {
  const results: ScoringBatchResult[] = [];

  for await (const entry of await getAnthropic().messages.batches.results(batchId)) {
    if (entry.result.type === "succeeded") {
      const text = entry.result.message.content.find((block) => block.type === "text")?.text ?? "{}";
      try {
        results.push({ customId: entry.custom_id, status: "succeeded", result: parseScoringText(text) });
      } catch (err) {
        results.push({
          customId: entry.custom_id,
          status: "errored",
          error: `Could not parse scoring response: ${text} (${err instanceof Error ? err.message : String(err)})`,
        });
      }
    } else if (entry.result.type === "errored") {
      results.push({ customId: entry.custom_id, status: "errored", error: entry.result.error.error.message });
    } else {
      results.push({ customId: entry.custom_id, status: entry.result.type, error: entry.result.type });
    }
  }

  return results;
}

// Convenience for ad-hoc scripts: build the same user prompt the batch
// requests use, for logging/debugging what was actually sent.
export { buildScoringUserPrompt };
