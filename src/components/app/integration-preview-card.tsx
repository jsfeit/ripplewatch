import { Plug, Handshake, LifeBuoy, Hash } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, avatarColor } from "@/lib/utils";

const NAME_ICON: Record<string, LucideIcon> = {
  hubspot: Handshake,
  intercom: LifeBuoy,
  slack: Hash,
};

// Read-only preview shown during onboarding — connecting a real integration
// requires OAuth against that provider, which can't happen before the
// account (and its redirect URIs) exist. Actually connecting happens in
// Settings, after signup.
export function IntegrationPreviewCard({ name, description }: { name: string; description: string }) {
  const Icon = NAME_ICON[name.toLowerCase()] ?? Plug;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-md", avatarColor(name))}>
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className="whitespace-nowrap rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">
        After signup
      </span>
    </div>
  );
}
