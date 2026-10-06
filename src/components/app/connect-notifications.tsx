"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { updateConnectNotificationsAction } from "@/app/app/settings/actions";
import { CONNECT_NOTIFICATIONS } from "@/lib/connect";

// What this account gets by email, and the two switches for the optional
// ones. Reads the catalogue the guide uses, so the text here is the same text.
export function ConnectNotifications({
  initialDailyAlert,
  initialMonthlyRecap,
  slackConnected,
}: {
  initialDailyAlert: boolean;
  initialMonthlyRecap: boolean;
  slackConnected: boolean;
}) {
  const [dailyAlert, setDailyAlert] = useState(initialDailyAlert);
  const [monthlyRecap, setMonthlyRecap] = useState(initialMonthlyRecap);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(next: { dailyAlert: boolean; monthlyRecap: boolean }) {
    setError(null);
    startTransition(async () => {
      const result = await updateConnectNotificationsAction(next);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save that. Try again.");
        setDailyAlert(initialDailyAlert);
        setMonthlyRecap(initialMonthlyRecap);
      }
    });
  }

  return (
    <div id="connect-notifications" className="scroll-mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">What you&apos;ll hear from us</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You can always ask your assistant for the latest. These are the messages that come to you.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {CONNECT_NOTIFICATIONS.map((n) => {
          const toggle =
            n.id === "daily"
              ? { checked: dailyAlert, onChange: (v: boolean) => (setDailyAlert(v), save({ dailyAlert: v, monthlyRecap })) }
              : n.id === "monthly"
                ? { checked: monthlyRecap, onChange: (v: boolean) => (setMonthlyRecap(v), save({ dailyAlert, monthlyRecap: v })) }
                : null;
          const slackNote = n.id === "slack" && !slackConnected ? " Not connected yet." : "";
          return (
            <li key={n.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {n.name} <span className="ml-1 text-xs font-normal text-muted-foreground">{n.cadence}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {n.when}
                  {slackNote}
                </p>
              </div>
              {toggle ? (
                <Switch
                  checked={toggle.checked}
                  onCheckedChange={toggle.onChange}
                  aria-label={`${n.name} email`}
                  className="mt-1"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/connect/guide" className="text-primary hover:underline">
          How to get the most out of Ripplewatch
        </Link>
      </p>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
