import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CONNECT_EXAMPLES, CONNECT_MCP_URL, CONNECT_NAME } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD, CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";

const description =
  "How to connect Ripplewatch to Claude, ChatGPT, Claude Code or Cursor over MCP: the server URL, the exact steps for each assistant, what to ask first, and what to do if sign-in doesn't open.";

export const metadata = {
  title: "Connect Ripplewatch to Claude or ChatGPT (MCP setup)",
  description,
  alternates: { canonical: "/connect/claude-and-chatgpt" },
  openGraph: { title: "Connect Ripplewatch to Claude or ChatGPT | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: {
    card: "summary_large_image",
    title: "Connect Ripplewatch to Claude or ChatGPT | Ripplewatch",
    description,
    images: ["/opengraph-image"],
  },
};

export default function ConnectGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">Connect Ripplewatch to Claude or ChatGPT</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        {CONNECT_NAME} is an MCP server. MCP, the Model Context Protocol, is the open standard that lets an AI assistant
        call outside tools, so once Ripplewatch is added you ask about your competitors in the chat you already have
        open. Setup takes about two minutes and works the same way in any assistant that supports remote MCP servers.
      </p>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">What you need</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
        <li>
          A {CONNECT_NAME} account: ${CONNECT_BASE_FEE_USD} a month plus usage you prepay for, starting at $
          {CONNECT_MIN_FUNDING_USD}.{" "}
          <Link href="/onboarding?path=connect" className="text-primary hover:underline">
            Get started
          </Link>
          .
        </li>
        <li>
          The server URL, which is the same in every assistant:{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 text-sm text-foreground">{CONNECT_MCP_URL}</code>. Use it
          exactly, including the <code>www</code>.
        </li>
      </ul>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">Claude</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
        <li>In Claude, go to Settings, then Connectors, then Add custom connector.</li>
        <li>Name it Ripplewatch and paste the server URL above.</li>
        <li>Sign in to Ripplewatch and approve the connection when it asks.</li>
      </ol>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        If the sign-in window doesn&apos;t open, connect with an API key instead. Create a key in Ripplewatch under
        Settings, then in the same Claude dialog open the advanced options, set authentication to &quot;No sign-in&quot;,
        and add a header named <code>Authorization</code> with the value <code>Bearer</code> followed by your key. Keep
        the key private: it can read your competitive intelligence and log deals on your account.
      </p>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">ChatGPT</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
        <li>In ChatGPT, open Plugins and use the + button to add a custom MCP server.</li>
        <li>Paste the server URL above and choose OAuth if it asks how to authenticate.</li>
        <li>Sign in to Ripplewatch and approve the connection.</li>
      </ol>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Whether you can add a custom MCP server depends on your ChatGPT plan and workspace settings. OpenAI&apos;s help
        center currently lists full support for Business, Enterprise and Edu workspaces, with more limited read access on
        some other plans, and an admin may need to enable it. On a read-only connection, logging deals won&apos;t work.
        If you don&apos;t see the option, your plan or workspace may not allow it yet. ChatGPT signs in through
        Ripplewatch instead of using an API key.
      </p>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">Claude Code, Cursor and other developer tools</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        These connect with an API key sent as a bearer token. In Claude Code:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm">
        <code>{`claude mcp add --transport http ripplewatch ${CONNECT_MCP_URL} \\
  --header "Authorization: Bearer rw_live_..."`}</code>
      </pre>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">What to ask first</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        For the full picture, including how to get your win/loss data in and what momentum means, see{" "}
        <Link href="/connect/guide" className="text-primary hover:underline">
          how to get the most out of Ripplewatch
        </Link>
        .
      </p>
      <ul className="mt-4 space-y-3">
        {CONNECT_EXAMPLES.map((q) => (
          <li key={q} className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm">
            &ldquo;{q}&rdquo;
          </li>
        ))}
      </ul>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        If you&apos;re not sure where to begin, ask it to start with Ripplewatch. It will tell you what it already knows
        about your competitors and the one thing that would make its answers sharper, usually a deal you won or lost.
      </p>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">If it doesn&apos;t connect</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
        <li>
          Remove the connector and add it again instead of editing it. An edited connector can reuse an old sign-in.
        </li>
        <li>Check the URL: it should start with https://www.ripplewatch.ai, not the bare domain.</li>
        <li>
          Still stuck? Email{" "}
          <a href="mailto:hello@ripplewatch.ai" className="text-primary hover:underline">
            hello@ripplewatch.ai
          </a>{" "}
          and a person will help.
        </li>
      </ul>

      <div className="mt-12">
        <Link href="/onboarding?path=connect" className={buttonVariants({ size: "lg" })}>
          Get {CONNECT_NAME}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
