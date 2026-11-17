"use client";

import { useState, useTransition } from "react";
import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateSlackDigestScheduleAction } from "@/app/app/settings/actions";

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: new Date(2026, 0, 1, hour).toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
}));

// The zones people actually pick: UTC and the US ones. The full list is about 400 names and reads as noise.
// Values are real IANA names, which the save action and the weekly cron already accept. A zone that is not
// in this list but is already saved, or is the browser's own (the "Use my timezone" link), is added to the
// end so the picker never shows a blank.
const COMMON_ZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix, no daylight saving)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "UTC", label: "UTC" },
];

function zoneLabel(tz: string): string {
  return COMMON_ZONES.find((z) => z.value === tz)?.label ?? tz.replace(/_/g, " ");
}

function timezoneOptions(current: string): { value: string; label: string }[] {
  return COMMON_ZONES.some((z) => z.value === current) ? COMMON_ZONES : [...COMMON_ZONES, { value: current, label: zoneLabel(current) }];
}

export function SlackDigestSchedule({
  initialTimezone,
  initialDay,
  initialHour,
}: {
  initialTimezone: string;
  initialDay: number;
  initialHour: number;
}) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [day, setDay] = useState(initialDay);
  const [hour, setHour] = useState(initialHour);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = timezone !== initialTimezone || day !== initialDay || hour !== initialHour;
  const browserTimezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateSlackDigestScheduleAction({ timezone, day, hour });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error ?? "Couldn't save");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Clock className="size-3.5 text-muted-foreground" />
        Weekly recap schedule
      </div>
      <p className="text-xs text-muted-foreground">
        One Slack message a week with the verdict and momentum read for the week, sent at this time, in this
        timezone.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Select value={String(day)} onValueChange={(v) => v && setDay(Number(v))}>
          <SelectTrigger className="w-[130px]">
            {/* Base UI's SelectValue render-prop is fed an unreliable arg on
              the pre-hydration render (sometimes null, sometimes the
              literal string "undefined"): reading the label straight from
              this component's own `day`/`hour`/`timezone` state instead of
              trying to parse whatever it passes in sidesteps that entirely,
              and is also just the value this component already has. */}
            <SelectValue>{() => DAYS.find((d) => d.value === day)?.label ?? ""}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DAYS.map((d) => (
              <SelectItem key={d.value} value={String(d.value)}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(hour)} onValueChange={(v) => v && setHour(Number(v))}>
          <SelectTrigger className="w-[110px]">
            <SelectValue>{() => HOURS.find((h) => h.value === hour)?.label ?? ""}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h.value} value={String(h.value)}>
                {h.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
          <SelectTrigger className="w-[260px]">
            <SelectValue>{() => zoneLabel(timezone)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {timezoneOptions(timezone).map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || isPending} onClick={save}>
          {saved ? (
            <>
              <Check className="size-3.5" /> Saved
            </>
          ) : isPending ? (
            "Saving…"
          ) : (
            "Save schedule"
          )}
        </Button>
        {browserTimezone && browserTimezone !== timezone ? (
          <button
            type="button"
            onClick={() => setTimezone(browserTimezone)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Use my timezone ({zoneLabel(browserTimezone)})
          </button>
        ) : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}
