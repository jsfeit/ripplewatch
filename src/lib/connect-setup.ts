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
