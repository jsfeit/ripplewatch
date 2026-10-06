import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { looksLikeApiKey } from "@/lib/api-keys";
import { authenticateOAuthAccessToken, bearerChallenge } from "@/lib/mcp-oauth";
import { canUseMcp } from "@/lib/tier-limits";
import { registerRipplewatchTools } from "@/lib/mcp-tools";
import { createAdminClient } from "@/lib/supabase/admin";

// Add-competitor and Ask can each take several seconds (domain check, URL
// discovery, an LLM call), same budget as their REST equivalents.
export const maxDuration = 120;

const handler = createMcpHandler(
  (server) => {
    registerRipplewatchTools(server);
  },
  {
    serverInfo: { name: "ripplewatch", version: "0.1.0" },
    instructions:
      "Ripplewatch tracks a company's competitors and explains what their moves mean for that company's deals. " +
      "At the start of a conversation, or whenever the user seems new or asks what to do, call start_here and guide them like a friendly onboarding partner: greet them by company name, be honest about what is ready, and offer one next step at a time. Otherwise start with get_briefing. When the user asks how Ripplewatch works, what momentum means, what emails or alerts they will get, or how to get their win/loss data in, call how_to_use rather than answering from memory. Every write and most read tools also return a next_best_action: the one thing the user could tell you that would make future answers more specific. " +
      "If you can also reach the user's other tools (a CRM, a call recorder like Gong, a support inbox), offer to pull their closed-won and closed-lost deals into import_win_loss and competitor mentions from calls into log_call_mentions: say what you'll read, get their okay, pass rows and snippets exactly as you read them, and never record anything you didn't actually see. " +
      "When it's relevant, ask the user for it conversationally, in your own words, and use the matching tool to record their answer. Don't invent deal outcomes or customer quotes: only log what the user actually tells you.",
  }
);

// Credentials are checked once per request in the wrapper below (so a
// rate-limited or downgraded caller gets its real status, not a generic 401),
// and handed to withMcpAuth's verifier through this map instead of being
// looked up a second time.
const verified = new WeakMap<Request, AuthInfo>();

const authedHandler = withMcpAuth(
  handler,
  (req, bearerToken) => {
    const info = verified.get(req);
    return info && info.token === bearerToken ? info : undefined;
  },
  { required: true }
);

// Two ways in: an rw_ API key (developer tools, Claude Code) or an OAuth
// access token issued through the connector flow (Claude and ChatGPT custom
// connectors, where the user signs in and approves instead of pasting a key).
// Both resolve to the same account-scoped identity.
async function handle(req: Request): Promise<Response> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  const auth = token
    ? looksLikeApiKey(token)
      ? await authenticateApiKey(token)
      : await authenticateOAuthAccessToken(token)
    : ({ ok: false, status: 401, error: "Authentication required." } as const);

  if (!auth.ok) {
    // A 401 carries the challenge that lets an OAuth-capable client discover
    // where to sign in; without a token at all that's the whole point.
    return Response.json(
      { error: auth.error },
      {
        status: auth.status,
        headers: auth.status === 401 ? { "WWW-Authenticate": bearerChallenge(req, token ? "invalid_token" : undefined) } : undefined,
      }
    );
  }

  // The MCP server is Ripplewatch Connect's product: a dashboard plan (with
  // its REST API) doesn't include it.
  if (!canUseMcp(auth.tier, auth.demoMode)) {
    return Response.json({ error: "Connecting an AI assistant requires Ripplewatch Connect." }, { status: 403 });
  }

  // Fire-and-forget: Settings reads this to show a real "connected" status
  // instead of assuming a copied URL was ever pasted anywhere. Never worth
  // adding latency to an actual tool call for.
  void createAdminClient()
    .from("accounts")
    .update({ mcp_last_connected_at: new Date().toISOString() })
    .eq("id", auth.accountId)
    .then(undefined, () => {});

  verified.set(req, {
    token,
    clientId: "clientId" in auth && typeof auth.clientId === "string" ? auth.clientId : "api-key",
    scopes: ["read", "write"],
    extra: { accountId: auth.accountId, tier: auth.tier },
  });
  return authedHandler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
