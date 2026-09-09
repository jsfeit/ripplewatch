// MOCK preview generator for the onboarding "aha" step. In production this
// becomes a real LLM call against the context profile; here it's a
// deterministic template so the preview alert updates live as the user types,
// without a backend.

export type PreviewInputs = {
  companyName: string;
  positioning: string;
  icp: string;
  competitorName: string;
  lossReason: string;
};

export type PreviewAlert = {
  competitorName: string;
  headline: string;
  reasoning: string;
};

const FALLBACK = {
  companyName: "your company",
  positioning: "your product",
  icp: "your target customers",
  competitorName: "a competitor",
  lossReason: "price came up in a recent deal",
};

export function generatePreviewAlert(inputs: PreviewInputs): PreviewAlert {
  const competitorName = inputs.competitorName.trim() || FALLBACK.competitorName;
  const positioning = inputs.positioning.trim() || FALLBACK.positioning;
  const icp = inputs.icp.trim() || FALLBACK.icp;
  const lossReason = inputs.lossReason.trim() || FALLBACK.lossReason;

  const headline = `${competitorName} quietly cut their entry-tier price this week`;

  const reasoning = `${competitorName} moving on price matters here because you told us ${
    inputs.lossReason.trim() ? `a recent lost deal came down to "${lossReason}"` : `you're still filling in why deals slip`
  }. That's why it's scored High for ${icp || FALLBACK.icp} weighing ${
    positioning || FALLBACK.positioning
  }, not just flagged as "something changed" the way a generic tool would.`;

  return { competitorName, headline, reasoning };
}
