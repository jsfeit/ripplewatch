"use client";

import { useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; text: string };

function suggestedPrompts(competitorNames: string[]): string[] {
  const first = competitorNames[0];
  return [
    first ? `What has ${first} changed recently that actually matters to us?` : "What's changed recently that actually matters to us?",
    "Which competitor is moving fastest right now, and on what?",
    "Has anyone changed pricing in a way that affects our positioning?",
  ];
}

export function AskChat({ competitorNames }: { competitorNames: string[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  return (
    <div className="flex flex-col">
      {messages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            Try asking
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {suggestedPrompts(competitorNames).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => ask(prompt)}
                className="rounded-md border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((message, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto border border-primary/20 bg-accent/60 text-foreground"
              )}
            >
              {message.text}
            </div>
          ))}
          {loading ? (
            <div className="mr-auto flex items-center gap-2 rounded-lg border border-primary/20 bg-accent/60 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Reading recent signals…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <form
        className="mt-5 flex items-end gap-2 rounded-lg border border-border bg-card p-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder="Ask about a competitor, a trend, or what's changed…"
          className="min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          rows={1}
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          <ArrowUp className="size-4" />
        </Button>
      </form>
    </div>
  );
}
