// How far along a Connect account is, shared by the sidebar and the Settings
// checklist so the two can never disagree about "2 of 4".
export type SetupInput = {
  connected: boolean;
  hasPositioning: boolean;
  competitorCount: number;
  slackConnected: boolean;
  hasDealHistory: boolean;
};

export function setupProgress(input: SetupInput): { done: number; total: number } {
  const steps = [
    input.connected,
    input.hasPositioning,
    input.competitorCount > 0,
    input.hasDealHistory,
    input.slackConnected,
  ];
  return { done: steps.filter(Boolean).length, total: steps.length };
}

// Testing shortcut for the staging deployment only: there is no real assistant to sign in from, so the
// "connected" step reads as done. Keyed on Vercel's branch name, which production never has.
export function connectedAt(real: string | null): string | null {
  if (real) return real;
  return process.env.VERCEL_GIT_COMMIT_REF === "staging" ? new Date().toISOString() : null;
}
