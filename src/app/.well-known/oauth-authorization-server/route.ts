import { authorizationServerMetadata, metadataPreflight } from "@/lib/mcp-oauth";

// Root-level discovery for MCP clients that don't try the path-inserted form.
// See authorizationServerMetadata in mcp-oauth.ts.
export const GET = (request: Request) => authorizationServerMetadata(request, "oauth-authorization-server");
export const OPTIONS = () => metadataPreflight();
