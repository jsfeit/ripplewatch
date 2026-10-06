// OpenAI verifies that we control the MCP hostname before it lets a plugin be
// submitted: its dashboard shows a token, and it fetches this URL expecting
// exactly that token as plain text (not JSON). The token is set as
// OPENAI_APPS_CHALLENGE_TOKEN in the environment, so rotating it is a config
// change, not a deploy of new code. Without it the route answers 404.
export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN?.trim();
  if (!token) return new Response("Not found", { status: 404 });
  return new Response(token, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
