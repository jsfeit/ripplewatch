import { protectedResourceMetadata, metadataPreflight } from "@/lib/mcp-oauth";

// RFC 9728 path-specific form for the resource at /api/mcp.
export const GET = (request: Request) => protectedResourceMetadata(request);
export const OPTIONS = () => metadataPreflight();
