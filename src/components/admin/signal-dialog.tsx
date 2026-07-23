"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SIGNAL_TYPE_LABELS } from "@/lib/mock-data";
import type { Database } from "@/lib/supabase/types";

type Signal = Database["public"]["Tables"]["signals"]["Row"];

export type SignalFormValues = {
  type: string;
  title: string;
  summary: string;
  occurred_on: string;
  scored: boolean;
  relevance_level: string;
  relevance_reasoning: string;
};

const SIGNAL_TYPES = Object.keys(SIGNAL_TYPE_LABELS);
const RELEVANCE_LEVELS = ["High", "Medium", "Low"];

const EMPTY_FORM: SignalFormValues = {
  type: "pricing",
  title: "",
  summary: "",
  occurred_on: new Date().toISOString().slice(0, 10),
  scored: false,
  relevance_level: "High",
  relevance_reasoning: "",
};

export function SignalDialog({
  open,
  signal,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  signal: Signal | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: SignalFormValues) => void;
}) {
  const [values, setValues] = useState<SignalFormValues>(() =>
    signal
      ? {
          type: signal.type,
          title: signal.title,
          summary: signal.summary ?? "",
          occurred_on: signal.occurred_on,
          scored: signal.scored,
          relevance_level: signal.relevance_level ?? "High",
          relevance_reasoning: signal.relevance_reasoning ?? "",
        }
      : EMPTY_FORM
  );

  function update<K extends keyof SignalFormValues>(key: K, value: SignalFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{signal ? "Edit signal" : "Add signal"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={values.type} onValueChange={(v) => v && update("type", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIGNAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SIGNAL_TYPE_LABELS[type as keyof typeof SIGNAL_TYPE_LABELS]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signal-title">Title</Label>
            <Input
              id="signal-title"
              value={values.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Competitor dropped their entry-tier price"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signal-summary">Summary</Label>
            <Textarea
              id="signal-summary"
              value={values.summary}
              onChange={(e) => update("summary", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signal-date">Date</Label>
            <Input
              id="signal-date"
              type="date"
              value={values.occurred_on}
              onChange={(e) => update("occurred_on", e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2">
            <Checkbox
              checked={values.scored}
              onCheckedChange={(v) => update("scored", Boolean(v))}
            />
            <span className="text-sm font-medium">Scored (relevance-scored alert)</span>
          </label>

          {values.scored ? (
            <>
              <div className="space-y-2">
                <Label>Relevance level</Label>
                <Select
                  value={values.relevance_level}
                  onValueChange={(v) => v && update("relevance_level", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELEVANCE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signal-reasoning">Relevance reasoning</Label>
                <Textarea
                  id="signal-reasoning"
                  value={values.relevance_reasoning}
                  onChange={(e) => update("relevance_reasoning", e.target.value)}
                  rows={3}
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSave(values)} disabled={!values.title.trim()}>
            {signal ? "Save changes" : "Add signal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
