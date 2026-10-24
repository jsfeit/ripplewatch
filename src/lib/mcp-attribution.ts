import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const ASSISTANTS = ["claude", "chatgpt", "cursor", "glama", "other", "unknown"] as const;
export type Assistant = (typeof ASSISTANTS)[number];

// Decides which assistant a connector client is. The redirect host is the reliable signal (a client
// can call itself anything when it registers); the registered name is the fallback for clients that
// redirect to a local port or a custom scheme, like Cursor and Claude Code.
export function classifyAssistant(clientName: string | null | undefined, redirectUri: string | null | undefined): Assistant {
  let host = "";
  let scheme = "";
  try {
    const url = new URL(redirectUri ?? "");
    host = url.hostname.toLowerCase();
    scheme = url.protocol.replace(":", "").toLowerCase();
  } catch {
    // leave blank
  }
  const name = (clientName ?? "").toLowerCase();
  const onDomain = (domain: string) => host === domain || host.endsWith(`.${domain}`);

  if (onDomain("claude.ai") || onDomain("claude.com")) return "claude";
  if (onDomain("chatgpt.com") || onDomain("openai.com")) return "chatgpt";
  if (onDomain("glama.ai")) return "glama";
  if (scheme === "cursor" || scheme === "vscode-cursor") return "cursor";

  if (name.includes("chatgpt") || name.includes("openai")) return "chatgpt";
  if (name.includes("claude")) return "claude";
  if (name.includes("cursor")) return "cursor";
  if (name.includes("glama")) return "glama";
  return name || host ? "other" : "unknown";
}

// Called when someone approves a connection. Never blocks the approval: a failure here (including the
// table not existing yet) is logged and swallowed.
export async function recordConnection(input: {
  accountId: string;
  clientId: string;
  clientName: string | null;
  redirectUri: string | null;
}): Promise<void> {
  try {
    let redirectHost: string | null = null;
    try {
      redirectHost = new URL(input.redirectUri ?? "").host || null;
    } catch {
      // not a URL
    }
    const { error } = await createAdminClient()
      .from("mcp_connections")
      .upsert(
        {
          account_id: input.accountId,
          client_id: input.clientId,
          client_name: input.clientName,
          redirect_host: redirectHost,
          assistant: classifyAssistant(input.clientName, input.redirectUri),
        },
        { onConflict: "account_id,client_id" }
      );
    if (error) console.warn("mcp attribution: couldn't record connection:", error.message);
  } catch (err) {
    console.warn("mcp attribution: couldn't record connection:", err);
  }
}

// One call per MCP request. Fire-and-forget by the caller; errors never reach the user.
export function touchConnection(accountId: string, clientId: string): void {
  void createAdminClient()
    .rpc("mcp_connection_touch", { p_account_id: accountId, p_client_id: clientId })
    .then(undefined, () => {});
}
