import { protectedResourceMetadata, metadataPreflight } from "@/lib/mcp-oauth";

// Some MCP clients probe the origin root instead of the path-specific
// document; both describe the same /api/mcp resource.
export const GET = (request: Request) => protectedResourceMetadata(request);
export const OPTIONS = () => metadataPreflight();
