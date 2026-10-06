// Where a Connect account's alerts and recaps go. Slack is the shared place
// the whole team can see, so once it's connected it gets them, and email stops
// unless the owner asks for both. With no Slack, email to the account owner is
// the only way anything reaches them, so it always sends.
export function connectDelivery(
  account: { connect_email_with_slack?: boolean | null },
  slackConnected: boolean
): { slack: boolean; email: boolean } {
  return { slack: slackConnected, email: !slackConnected || account.connect_email_with_slack === true };
}
