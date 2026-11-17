"use client";

import { LifeBuoy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CopyPromptButton } from "@/components/app/copy-prompt-button";

// Shown under a failed Slack connection. Slack's own error pages are written for app developers, so this
// says what usually went wrong in plain words, who can fix it, and what to do meanwhile. Email alerts keep
// working the whole time, so Slack is never a blocker.
const ADMIN_NOTE =
  "Hi, could you approve the Ripplewatch app for our Slack workspace? It posts a short daily competitor update to one channel. It only needs permission to post to the channel we choose, and it can't read messages. When it's approved I'll connect it from Ripplewatch Settings, or you can: https://www.ripplewatch.ai/app/settings?tab=manage";

const REASONS: { title: string; body: string }[] = [
  {
    title: "Your workspace needs an admin to approve it",
    body: "Many companies only let admins add apps. Send the note below to whoever runs your Slack and try again once they say yes.",
  },
  {
    title: "You picked a different workspace than you meant",
    body: "Slack remembers the last workspace you used. Use the workspace menu at the top right of Slack's page to switch, then continue.",
  },
  {
    title: "You were signed out of Slack, or closed the page",
    body: "Nothing was changed. Starting again takes a few seconds.",
  },
  {
    title: "It's us, not you",
    body: "If none of that fits, email hello@ripplewatch.ai with the time you tried and we'll connect it with you.",
  },
];

export function SlackTroubleHelp() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <LifeBuoy className="size-4 text-primary" />
        Getting Slack connected
      </div>
      <p className="mt-1 text-muted-foreground">
        You haven&apos;t lost anything. Your alerts keep arriving by email while this gets sorted, and your assistant works as normal.
      </p>
      <ul className="mt-3 space-y-2.5">
        {REASONS.map((r) => (
          <li key={r.title}>
            <p className="font-medium">{r.title}</p>
            <p className="text-muted-foreground">{r.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/api/integrations/slack/connect?next=%2Fapp%2Fsettings%3Ftab%3Dmanage" target="_blank" rel="noopener" className={buttonVariants({ size: "sm" })}>
          Try Slack again
        </a>
        <CopyPromptButton text={ADMIN_NOTE} label="Copy a note for your Slack admin" />
        <a href="/faq" target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
          More tips
        </a>
        <a href="mailto:hello@ripplewatch.ai?subject=Help%20connecting%20Slack" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Email us
        </a>
      </div>
    </div>
  );
}
