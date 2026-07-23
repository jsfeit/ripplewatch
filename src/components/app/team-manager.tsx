"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, UserMinus, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SEAT_LIMIT, seatLimitLabel } from "@/lib/tier-limits";
import type { Database } from "@/lib/supabase/types";

type Tier = Database["public"]["Tables"]["accounts"]["Row"]["tier"];
type Member = { id: string; email: string; role: string; createdAt: string };
type Invite = { id: string; email: string; created_at: string };

export function TeamManager({ tier, currentUserId }: { tier: Tier; currentUserId: string }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    fetch("/api/team/invite")
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members ?? []);
        setInvites(data.invites ?? []);
      })
      .catch(() => {});
  }

  useEffect(refresh, []);

  const seatLimit = SEAT_LIMIT[tier];
  const seatsUsed = (members?.length ?? 0) + invites.length;
  const atLimit = seatsUsed >= seatLimit;

  async function handleInvite() {
    if (!email.trim()) return;
    setInviting(true);
    setError("");
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send invite.");
      return;
    }
    setEmail("");
    refresh();
  }

  async function handleRevoke(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/team/invite/${id}`, { method: "DELETE" });
  }

  async function handleRemoveMember(id: string) {
    setMembers((prev) => (prev ?? []).filter((m) => m.id !== id));
    await fetch(`/api/team/members/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {seatsUsed} of {seatLimitLabel(tier)} seats used.
      </p>

      {atLimit ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-400">
          You&apos;re at your plan&apos;s seat limit.{" "}
          <Link href="/pricing" className="underline">
            Upgrade
          </Link>{" "}
          for unlimited seats.
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            type="email"
            className="flex-1"
          />
          <Button type="button" onClick={handleInvite} disabled={inviting}>
            {inviting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Invite
          </Button>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-2">
        {(members ?? []).map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
          >
            <div>
              <p className="font-medium">{m.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
            </div>
            {m.id !== currentUserId ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveMember(m.id)}
                aria-label={`Remove ${m.email}`}
              >
                <UserMinus className="size-4" />
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">You</span>
            )}
          </div>
        ))}

        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground"
          >
            <div>
              <p className="font-medium text-foreground">{invite.email}</p>
              <p className="text-xs">Invite pending</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRevoke(invite.id)}
              aria-label={`Revoke invite to ${invite.email}`}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      {members === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {atLimit ? null : (
        <Link href="/pricing" className={cn(buttonVariants({ variant: "link", size: "sm" }), "px-0")}>
          Compare seat limits by plan
        </Link>
      )}
    </div>
  );
}
