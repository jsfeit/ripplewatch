import { LegalDoc } from "@/components/marketing/legal-doc";

const description =
  "Connect Ripplewatch to Claude, ChatGPT or any assistant that supports remote MCP servers, and see the tools it exposes.";

export const metadata = {
  title: "Connector Docs",
  description,
  alternates: { canonical: "/docs/api" },
  openGraph: { title: "Connector Docs | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Connector Docs | Ripplewatch", description, images: ["/opengraph-image"] },
};

function Code({ children }: { children: string }) {
  return (
    <pre className="not-prose mt-2 overflow-x-auto rounded-md border border-border bg-secondary/30 p-3 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocsPage() {
  return (
    <LegalDoc title="Connector docs" updated="October 23, 2026">
      <p className="text-muted-foreground">
        Ripplewatch runs as an MCP server, so an assistant like Claude or ChatGPT can answer questions
        about your competitors and record what you tell it, right in the chat.
      </p>

      <h2>Connect an AI assistant (MCP)</h2>
      <p>The connector URL:</p>
      <Code>{`https://www.ripplewatch.ai/api/mcp`}</Code>
      <p>
        In Claude or ChatGPT you don&apos;t need a key: add <code>https://www.ripplewatch.ai/api/mcp</code> as a
        custom connector, sign in to Ripplewatch when prompted, and approve the connection. Manage connected apps
        under Settings → Developer. This needs a Ripplewatch account. For step-by-step setup, see{" "}
        <a href="/connect/claude-and-chatgpt">Connect to Claude or ChatGPT</a>.
      </p>
      <p>
        For developer tools that take a key instead, generate one under{" "}
        <a href="/app/settings?tab=developer">Settings → Developer</a> and send it as a bearer token. In Claude
        Code, for example:
      </p>
      <Code>{`claude mcp add --transport http ripplewatch https://www.ripplewatch.ai/api/mcp \\
  --header "Authorization: Bearer rw_live_..."`}</Code>

      <h2>Tools</h2>
      <ul>
        <li><code>get_briefing</code> - start here: the weekly verdict, who is heating up or cooling, and the top recent signals.</li>
        <li><code>ask</code> - a free-form question answered against your positioning, ICP and the last 90 days of signals.</li>
        <li><code>list_competitors</code>, <code>get_competitor</code>, <code>get_momentum</code>, <code>get_trends</code> - read what Ripplewatch knows.</li>
        <li><code>add_competitor</code>, <code>log_win_loss</code>, <code>log_customer_feedback</code>, <code>set_context</code> - record what you tell the assistant.</li>
        <li><code>get_next_step</code> - the one thing you could share that would make answers more specific.</li>
      </ul>
      <p>
        Signal text comes from public third-party sources, so tool results label it as data rather than
        instructions. Requests are limited to 60 per minute per key, and each tool call counts as a request.
      </p>

      <h2>Public repository</h2>
      <p>
        The setup steps, the full tool list and the MCP Registry manifest are also published, documentation only, at{" "}
        <a href="https://github.com/jsfeit/ripplewatch-mcp" target="_blank" rel="noopener noreferrer">
          github.com/jsfeit/ripplewatch-mcp
        </a>
        . The registry name is <code>ai.ripplewatch/ripplewatch</code>.
      </p>

      <h2>Errors</h2>
      <ul>
        <li><code>401</code> - missing, malformed, or revoked API key.</li>
        <li><code>403</code> - your Ripplewatch subscription isn&apos;t active.</li>
        <li><code>429</code> - rate limit exceeded. Retry after a few seconds.</li>
        <li><code>500</code> - something went wrong on our end.</li>
      </ul>
    </LegalDoc>
  );
}
