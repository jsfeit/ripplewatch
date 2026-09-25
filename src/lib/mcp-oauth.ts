import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";
import { API_ACCESS_ALLOWED } from "@/lib/tier-limits";
import { checkRateLimit } from "@/lib/rate-limit";

// Ripplewatch doesn't run its own OAuth server: Supabase Auth's OAuth 2.1
// server issues the tokens (it handles client registration, PKCE, code and
// refresh-token exchange), and our own pieces are the consent page
// (/oauth/consent) and this resource-server side that verifies what it issued
// and maps it to an account. The trust chain is: a signed-in Ripplewatch user
// approves a client on our consent screen, Supabase issues that client a token
// for that user, and every MCP call is scoped to the user's account.

function supabaseAuthIssuer(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks() {
  cachedJwks ??= createRemoteJWKSet(new URL(`${supabaseAuthIssuer()}/.well-known/jwks.json`));
  return cachedJwks;
}

const RATE_LIMIT_PER_MINUTE = 60;

export type OAuthAuth =
  | { ok: true; accountId: string; userId: string; clientId: string }
  | { ok: false; status: 401 | 403 | 429; error: string };

// Verifies a Supabase-issued OAuth access token and resolves the account it
// acts on. Requires the client_id claim, which only tokens issued through the
// OAuth flow carry: a plain login session token for the same user is a valid
// Supabase JWT too, but it isn't something a connected app should be handing
// us, so it's rejected rather than treated as an equivalent credential.
export async function authenticateOAuthAccessToken(token: string): Promise<OAuthAuth> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks(), { issuer: supabaseAuthIssuer() }));
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired access token." };
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const clientId = typeof payload.client_id === "string" ? payload.client_id : "";
  if (!userId || !clientId) {
    // Claim names only (never values), so a mismatch with what Supabase
    // actually issues is diagnosable from the logs.
    console.warn("mcp oauth: token missing sub/client_id; claims present:", Object.keys(payload).join(","));
    return { ok: false, status: 401, error: "This token was not issued through the Ripplewatch connector flow." };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("account_id").eq("id", userId).maybeSingle();
  if (!profile?.account_id) {
    return { ok: false, status: 403, error: "Finish setting up your Ripplewatch account first." };
  }

  // Same plan gate as API keys, checked on every request so a downgrade cuts
  // off connected apps immediately instead of when the token expires.
  const { data: account } = await supabase.from("accounts").select("tier").eq("id", profile.account_id).single();
  if (!account || !API_ACCESS_ALLOWED[account.tier]) {
    return { ok: false, status: 403, error: "Connecting an AI assistant requires the Plus plan." };
  }

  if (!checkRateLimit(`mcp-oauth:${userId}`, RATE_LIMIT_PER_MINUTE, 60_000)) {
    return { ok: false, status: 429, error: "Rate limit exceeded. Try again shortly." };
  }

  return { ok: true, accountId: profile.account_id, userId, clientId };
}

// RFC 9728 Protected Resource Metadata: tells an MCP client which
// authorization server to use for /api/mcp. The resource identifier has to
// match the URL the client connects to, so it's built from the request's own
// origin rather than a configured value that could disagree with it.
export function protectedResourceMetadata(request: Request): Response {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [supabaseAuthIssuer()],
      bearer_methods_supported: ["header"],
      resource_name: "Ripplewatch",
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } }
  );
}

export function metadataPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

// The 401 challenge that lets a client that hasn't authenticated yet find the
// metadata above and start the OAuth flow.
export function bearerChallenge(request: Request, error?: string): string {
  const origin = new URL(request.url).origin;
  const parts = [`resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`];
  if (error) parts.unshift(`error="${error}"`);
  return `Bearer ${parts.join(", ")}`;
}
