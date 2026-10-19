"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "@/lib/analytics";
import { CONTACT_TOPICS, type ContactTopicId } from "@/lib/contact-topics";
import { DEMO_URL } from "@/lib/demo";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function BookingLink({ className }: { className?: string }) {
  return (
    <a
      href={DEMO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: "outline", className })}
    >
      <Calendar className="size-4" />
      Pick a time on the calendar
    </a>
  );
}

export function ContactForm({ initialTopic }: { initialTopic: ContactTopicId }) {
  const [topic, setTopic] = useState<ContactTopicId>(initialTopic);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const current = CONTACT_TOPICS.find((t) => t.id === topic) ?? CONTACT_TOPICS[0];
  const messageOk = current.messageOptional || message.trim().length >= 5;
  const canSubmit = name.trim().length > 0 && EMAIL_PATTERN.test(email.trim()) && messageOk;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, name, email, company, message, website }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Something went wrong. Try again.");
        setStatus("error");
        return;
      }
      trackEvent("contact_request", { topic });
      setStatus("done");
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-accent/40 p-8 text-center">
        <CheckCircle2 className="size-6 text-primary" />
        <p className="font-medium">Thanks, we have it.</p>
        <p className="text-sm text-muted-foreground">
          We read every message and reply by email, usually within a business day.
        </p>
        {topic === "demo" ? <BookingLink className="mt-2" /> : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="contact-topic">What can we help with?</Label>
        <select
          id="contact-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopicId)}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {CONTACT_TOPICS.map((t) => (
            <option key={t.id} value={t.id} className="bg-background text-foreground">
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {topic === "demo" ? (
        <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm">
          <p className="text-muted-foreground">
            Happy to walk you through Ripplewatch. Pick a time yourself, or send the form and we&apos;ll
            find one with you.
          </p>
          <BookingLink className="mt-3" />
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Your name</Label>
          <Input id="contact-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Work email</Label>
          <Input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-company">Company (optional)</Label>
        <Input id="contact-company" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">
          {topic === "demo" ? "Anything we should know? (optional)" : "How can we help?"}
        </Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder={topic === "support" ? "What's going on? Include the email on your account." : ""}
        />
      </div>

      {/* Honeypot: hidden from people, filled in by bots. */}
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={status === "loading" || !canSubmit}>
        {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
        Send message
      </Button>
    </form>
  );
}
