import Link from "next/link";
import { CheckCircle2, Plug, Hash, Mail, Handshake, Headphones, Video, LifeBuoy, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, avatarColor } from "@/lib/utils";

const PROVIDER_ICON: Record<string, LucideIcon> = {
  slack: Hash,
  email: Mail,
  hubspot: Handshake,
  gong: Headphones,
  zoom: Video,
  intercom: LifeBuoy,
};

// Real connect/disconnect — links to an OAuth-initiating route rather than
// faking a connection locally like the onboarding-wizard mock connectors do.
export function IntegrationConnector({
  name,
  description,
  connected,
  connectHref,
  provider,
  disconnectAction,
  requiresUpgrade,
  comingSoon,
}: {
  name: string;
  description: string;
  connected: boolean;
  connectHref: string;
  provider: string;
  disconnectAction?: (formData: FormData) => void;
  requiresUpgrade?: boolean;
  comingSoon?: boolean;
}) {
  const Icon = PROVIDER_ICON[provider] ?? Plug;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors",
        connected ? "border-primary/25 bg-primary/[0.03]" : "border-border bg-card",
        comingSoon && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-md", avatarColor(provider))}>
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {comingSoon ? (
        <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <Clock className="size-3.5" />
          Coming soon
        </span>
      ) : connected ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <CheckCircle2 className="size-3.5" />
            Connected
          </span>
          {disconnectAction ? (
            <form action={disconnectAction}>
              <input type="hidden" name="provider" value={provider} />
              <Button type="submit" variant="ghost" size="sm">
                Disconnect
              </Button>
            </form>
          ) : null}
        </div>
      ) : requiresUpgrade ? (
        <Link href="/pricing" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Upgrade to connect
        </Link>
      ) : (
        <Link href={connectHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Connect
        </Link>
      )}
    </div>
  );
}
