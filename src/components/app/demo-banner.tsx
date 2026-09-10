import { AlertOctagon } from "lucide-react";

// Shown for every account with demo_mode set — the full app, same as any
// real account, with the one difference (billing disabled, enforced
// server-side in the Stripe routes) called out here so it's never a
// silent restriction. Not dismissible: it's a fact about the account, not
// a one-time notice.
export function DemoBanner() {
  return (
    <div className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">
      <AlertOctagon className="size-4 shrink-0" />
      DEMO — billing is disabled on this account
    </div>
  );
}
