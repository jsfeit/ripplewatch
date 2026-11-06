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
// "connected" step can be made to read as done. Off by default so staging shows the real connect step,
// including that it blocks Continue until an assistant connects. Turn it on by setting
// STAGING_FAKE_CONNECT=1 on the staging branch in Vercel, to look at the screens after connecting.
// Also keyed on Vercel's branch name, which production never has.
export function connectedAt(real: string | null): string | null {
  if (real) return real;
  const fake = process.env.STAGING_FAKE_CONNECT === "1" && process.env.VERCEL_GIT_COMMIT_REF === "staging";
  return fake ? new Date().toISOString() : null;
}
