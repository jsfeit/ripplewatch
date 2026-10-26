import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// How long audit entries are kept before /api/cron/audit-log-purge removes them.
export const AUDIT_RETENTION_MONTHS = 12;

// What happened, as "thing.verb". The Settings log shows AUDIT_LABELS[action].
export const AUDIT_LABELS = {
  "api_key.created": "API key created",
  "api_key.revoked": "API key revoked",
  "team.invited": "Teammate invited",
  "team.removed": "Teammate removed",
  "assistant.connected": "AI assistant connected",
  "assistant.disconnected": "AI assistant disconnected",
  "competitor.added": "Competitor added",
  "competitor.removed": "Competitor removed",
  "deal.logged": "Won or lost deal logged",
  "feedback.logged": "Customer feedback logged",
  "context.updated": "Business context updated",
  "integration.connected": "Integration connected",
  "integration.disconnected": "Integration disconnected",
  "billing.subscription_started": "Subscription started",
  "billing.subscription_canceled": "Subscription cancelled",
  "billing.balance_added": "Balance added",
} as const;

export type AuditAction = keyof typeof AUDIT_LABELS;

// The IP address is only kept for actions that change who or what can get in,
// not for everyday data entry, to keep the personal data to what a security
// review actually needs. Change this set to widen or narrow it.
const IP_ACTIONS = new Set<AuditAction>([
  "api_key.created",
  "api_key.revoked",
  "team.invited",
  "team.removed",
  "assistant.connected",
  "assistant.disconnected",
  "integration.connected",
  "integration.disconnected",
]);

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || null;
}

export type AuditEvent = {
  accountId: string;
  actorType: "user" | "assistant" | "system";
  actorId?: string | null;
  // An email for a person, the app's name for an assistant, "Ripplewatch" or "Stripe" for the system.
  actorLabel?: string | null;
  action: AuditAction;
  target?: string | null;
  detail?: Record<string, unknown> | null;
  headers?: Headers;
};

// Records one entry. Never throws and never blocks the action it describes: a
// log write that fails is reported to the server log and nothing else.
export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("audit_log")
      .insert({
        account_id: event.accountId,
        actor_type: event.actorType,
        actor_id: event.actorId ?? null,
        actor_label: event.actorLabel ?? null,
        action: event.action,
        target: event.target ?? null,
        detail: event.detail ?? null,
        ip: event.headers && IP_ACTIONS.has(event.action) ? clientIp(event.headers) : null,
      });
    if (error) console.error("audit log write failed:", error.message);
  } catch (err) {
    console.error("audit log write failed:", err instanceof Error ? err.message : err);
  }
}

// Names the assistant behind an MCP request for the log: the app's own name if
// the sign-in told us one, else which assistant it is, and "API key" for a
// connection made with a key instead of a sign-in.
export async function assistantLabel(accountId: string, clientId: string | undefined): Promise<string> {
  if (!clientId || clientId === "api-key") return "API key";
  try {
    const { data } = await createAdminClient()
      .from("mcp_connections")
      .select("client_name, assistant")
      .eq("account_id", accountId)
      .eq("client_id", clientId)
      .maybeSingle();
    return data?.client_name || (data?.assistant && data.assistant !== "unknown" ? data.assistant : "") || "AI assistant";
  } catch {
    return "AI assistant";
  }
}
