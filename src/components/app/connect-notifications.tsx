"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { updateConnectNotificationsAction } from "@/app/app/settings/actions";
import { CONNECT_NOTIFICATIONS } from "@/lib/connect";

type Prefs = { dailyAlert: boolean; monthlyRecap: boolean; emailWithSlack: boolean };

// What this account gets and where it goes, plus the switches. Slack is where
// a team sees things, so with Slack connected the alerts and recaps go there
// and email is an extra the owner can ask for. Reads the catalogue the guide
// uses, so the text here is the same text.
export function ConnectNotifications({
  initialDailyAlert,
  initialMonthlyRecap,
  initialEmailWithSlack,
  slackConnected,
}: {
  initialDailyAlert: boolean;
  initialMonthlyRecap: boolean;
  initialEmailWithSlack: boolean;
  slackConnected: boolean;
}) {
  const initial: Prefs = { dailyAlert: initialDailyAlert, monthlyRecap: initialMonthlyRecap, emailWithSlack: initialEmailWithSlack };
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function change(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setError(null);
    startTransition(async () => {
      const result = await updateConnectNotificationsAction(next);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save that. Try again.");
        setPrefs(prefs);
      }
    });
  }

  return (
    <div id="connect-notifications" className="scroll-mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">What you&apos;ll hear from us</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {slackConnected
          ? "Slack is where your team sees alerts and recaps. Email is a backup you can add."
          : "These come to the email address on your account. Connect Slack below so the whole team sees them in a channel instead."}{" "}
        You can always ask your assistant for the latest.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {CONNECT_NOTIFICATIONS.map((n) => {
          const toggle =
            n.id === "daily"
              ? { checked: prefs.dailyAlert, onChange: (v: boolean) => change({ dailyAlert: v }) }
              : n.id === "monthly"
                ? { checked: prefs.monthlyRecap, onChange: (v: boolean) => change({ monthlyRecap: v }) }
                : null;
          return (
            <li key={n.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {n.name} <span className="ml-1 text-xs font-normal text-muted-foreground">{n.cadence}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.when}</p>
              </div>
              {toggle ? (
                <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} aria-label={n.name} className="mt-1" />
              ) : null}
            </li>
          );
        })}
      </ul>
      {slackConnected ? (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg bg-secondary/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Also email me</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Send the alerts, weekly briefing and monthly recap to your email as well as Slack.
            </p>
          </div>
          <Switch
            checked={prefs.emailWithSlack}
            onCheckedChange={(v) => change({ emailWithSlack: v })}
            aria-label="Also email me"
            className="mt-1"
          />
        </div>
      ) : null}
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/connect/guide" className="text-primary hover:underline">
          How to get the most out of Ripplewatch
        </Link>
      </p>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
