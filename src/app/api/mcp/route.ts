import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { registerRipplewatchTools } from "@/lib/mcp-tools";

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
      "Start with get_briefing. Every write and most read tools also return a next_best_action: the one thing the user could tell you that would make future answers more specific. " +
      "When it's relevant, ask the user for it conversationally, in your own words, and use the matching tool to record their answer. Don't invent deal outcomes or customer quotes: only log what the user actually tells you.",
  }
);

// The API key is checked once per request in the wrapper below (so a
// rate-limited or downgraded key gets its real status, not a generic 401),
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

async function handle(req: Request): Promise<Response> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  const auth = await authenticateApiKey(token);
  if (!auth.ok) {
    return Response.json(
      { error: auth.error },
      { status: auth.status, headers: auth.status === 401 ? { "WWW-Authenticate": "Bearer" } : undefined }
    );
  }

  verified.set(req, {
    token,
    clientId: "api-key",
    scopes: ["read", "write"],
    extra: { accountId: auth.accountId },
  });
  return authedHandler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
