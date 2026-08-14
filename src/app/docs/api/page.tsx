import { LegalDoc } from "@/components/marketing/legal-doc";

const description = "Read-only REST API for pulling Ripplewatch's competitive intel into your own agents or tools.";

export const metadata = {
  title: "API Docs",
  description,
  alternates: { canonical: "/docs/api" },
  openGraph: { title: "API Docs | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "API Docs | Ripplewatch", description, images: ["/opengraph-image"] },
};

function Endpoint({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <div className="not-prose mt-3 rounded-lg border border-border p-3">
      <p className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{method}</span>
        {path}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <LegalDoc title="API" updated="August 12, 2026">
      <p className="text-muted-foreground">
        A read-only REST API for pulling your competitive intel into your own agents or tools, instead of a
        person reading the dashboard. Available on Plus and Advanced plans: generate a key from{" "}
        <a href="/app/settings?tab=developer">Settings → Developer</a>.
      </p>

      <h2>Authentication</h2>
      <p>
        Send your key as a bearer token on every request:
        <br />
        <code className="mt-2 block rounded-md border border-border bg-secondary/30 p-2 text-xs">
          Authorization: Bearer rw_live_...
        </code>
      </p>
      <p>
        Keys are shown once at creation and never stored in plaintext: if you lose one, revoke it and generate a
        new one. Requests are rate-limited to 60/minute per key.
      </p>

      <h2>Endpoints</h2>
      <div className="not-prose space-y-2">
        <Endpoint method="GET" path="/api/v1/competitors" description="List your tracked competitors." />
        <Endpoint
          method="GET"
          path="/api/v1/competitors/:id"
          description="A single competitor, including its fact sheet (why you win/lose)."
        />
        <Endpoint
          method="GET"
          path="/api/v1/signals"
          description="Scored signals across your competitors. Filter with competitor_id, type, relevance_level, since (YYYY-MM-DD), limit, offset."
        />
        <Endpoint
          method="GET"
          path="/api/v1/trends"
          description="Recurring win/loss themes across every logged reason, with any real signals they connect to."
        />
        <Endpoint method="GET" path="/api/v1/momentum" description="Momentum score and label per competitor." />
        <Endpoint
          method="GET"
          path="/api/v1/verdict"
          description="This week's synthesized takeaway, if one has been generated in the last 8 days."
        />
      </div>

      <h2>Response shape</h2>
      <p>
        Every endpoint returns <code>{"{ data: ... }"}</code>: an array for list endpoints, an object for single
        resources. Errors return <code>{"{ error: string }"}</code> with a 4xx/5xx status.
      </p>
    </LegalDoc>
  );
}
