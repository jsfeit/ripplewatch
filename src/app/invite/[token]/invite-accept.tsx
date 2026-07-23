"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Waves } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function InviteAccept({
  token,
  inviteEmail,
  accountName,
  alreadyAccepted,
  signedInAs,
}: {
  token: string;
  inviteEmail: string;
  accountName: string;
  alreadyAccepted: boolean;
  signedInAs: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "accepting" | "done" | "error">(
    signedInAs && !alreadyAccepted ? "accepting" : "idle"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedInAs || alreadyAccepted) return;

    fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not accept this invite.");
          setStatus("error");
          return;
        }
        setStatus("done");
        setTimeout(() => {
          router.push("/app/dashboard");
          router.refresh();
        }, 1200);
      })
      .catch(() => {
        setError("Could not accept this invite.");
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInAs, alreadyAccepted, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="size-4" />
          </span>
          Ripplewatch
        </Link>
        <Card>
          <CardHeader>
            <h1 className="text-lg font-semibold">Join {accountName} on Ripplewatch</h1>
            <p className="text-sm text-muted-foreground">Invited as {inviteEmail}</p>
          </CardHeader>
          <CardContent>
            {alreadyAccepted ? (
              <p className="text-sm text-muted-foreground">
                This invite has already been used. If that was you,{" "}
                <Link href="/login" className="text-primary hover:underline">
                  log in
                </Link>{" "}
                instead.
              </p>
            ) : status === "done" ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle2 className="size-8 text-primary" />
                <p className="text-sm font-medium">You&apos;re in. Redirecting…</p>
              </div>
            ) : status === "accepting" ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Joining the workspace…</p>
              </div>
            ) : status === "error" ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sign up or log in with {inviteEmail} to join.
                </p>
                <Link
                  href={`/signup?invite=${token}&email=${encodeURIComponent(inviteEmail)}`}
                  className={cn(buttonVariants(), "w-full")}
                >
                  Sign up
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Log in
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
