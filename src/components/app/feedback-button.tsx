"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Category = "bug" | "idea" | "general";
type SendState = "idle" | "sending" | "sent" | "error";

const CATEGORY_LABEL: Record<Category, string> = {
  bug: "Something's broken",
  idea: "Feature idea",
  general: "General feedback",
};

// Deliberately a plain fetch to an API route rather than a support-ticket
// widget with its own history/thread — this goes straight to the founder's
// inbox (see sendFeedbackEmail) and there's nothing to read back in-app, so
// a one-shot "send and confirm" dialog is the whole feature.
export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("general");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SendState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, pagePath: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setState("sent");
      setTimeout(() => {
        setOpen(false);
        // Reset after the close animation rather than mid-dialog, so the
        // "Sent" confirmation doesn't visibly flicker back to a blank form.
        setTimeout(() => {
          setMessage("");
          setCategory("general");
          setState("idle");
        }, 200);
      }, 1200);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <MessageSquarePlus className="size-3.5" />
            Feedback
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Goes straight to the founder — bugs, rough edges, or things you wish Ripplewatch did differently.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-category" className="text-xs text-muted-foreground">
              What&apos;s this about?
            </Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v as Category)}>
              <SelectTrigger id="feedback-category" className="w-full">
                <SelectValue>{() => CATEGORY_LABEL[category]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-message" className="text-xs text-muted-foreground">
              What&apos;s going on?
            </Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="The more specific, the faster it's useful — what you were doing, what you expected, what happened instead."
              rows={5}
              maxLength={4000}
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={send} disabled={!message.trim() || state === "sending" || state === "sent"}>
            {state === "sending" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Sending…
              </>
            ) : state === "sent" ? (
              <>
                <Check className="size-3.5" /> Sent
              </>
            ) : (
              "Send"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
