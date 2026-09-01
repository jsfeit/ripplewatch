import { LegalDoc } from "@/components/marketing/legal-doc";

const description =
  "REST API for pulling Ripplewatch's competitive intel into your own agents or tools, and pushing win/loss data in.";

export const metadata = {
  title: "API Docs",
  description,
  alternates: { canonical: "/docs/api" },
  openGraph: { title: "API Docs | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "API Docs | Ripplewatch", description, images: ["/opengraph-image"] },
};

function Code({ children }: { children: string }) {
  return (
    <pre className="not-prose mt-2 overflow-x-auto rounded-md border border-border bg-secondary/30 p-3 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Param({
  name,
  type,
  children,
}: {
  name: string;
  type: string;
  children: React.ReactNode;
}) {
  return (
    <li className="text-xs">
      <code className="rounded bg-secondary/50 px-1 py-0.5 font-mono">{name}</code>{" "}
      <span className="text-muted-foreground">({type})</span> — {children}
    </li>
  );
}

function Endpoint({
  method,
  path,
  description,
  params,
  example,
  response,
}: {
  method: string;
  path: string;
  description: string;
  params?: React.ReactNode;
  example: string;
  response: string;
}) {
  return (
    <div className="not-prose mt-3 rounded-lg border border-border p-4">
      <p className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{method}</span>
        {path}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>

      {params ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {method === "POST" ? "Body params" : "Query params"}
          </p>
          <ul className="mt-1.5 space-y-1">{params}</ul>
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Example</p>
        <Code>{example}</Code>
      </div>
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Response</p>
        <Code>{response}</Code>
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <LegalDoc title="API" updated="August 25, 2026">
      <p className="text-muted-foreground">
        A REST API for pulling your competitive intel into your own agents or tools, instead of a person reading
        the dashboard, and for pushing win/loss data in the moment a deal closes instead of batch-exporting a
        CSV later. Available on Plus and Advanced plans: generate a key from{" "}
        <a href="/app/settings?tab=developer">Settings → Developer</a>.
      </p>

      <h2>Quickstart</h2>
      <p>Every request needs your key as a bearer token. This lists your tracked competitors:</p>
      <Code>{`curl https://www.ripplewatch.ai/api/v1/competitors \\
  -H "Authorization: Bearer rw_live_..."`}</Code>

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
        new one from Settings → Developer. Requests are rate-limited to 60/minute per key, tracked in a rolling
        60-second window.
      </p>

      <h2>Endpoints</h2>
      <div className="not-prose space-y-3">
        <Endpoint
          method="GET"
          path="/api/v1/competitors"
          description="List every competitor tracked on your account, oldest first."
          example={`curl https://www.ripplewatch.ai/api/v1/competitors \\
  -H "Authorization: Bearer rw_live_..."`}
          response={`{
  "data": [
    {
      "id": "b3f1...",
      "name": "Xero",
      "domain": "xero.com",
      "category": "Accounting software",
      "pricing_url": "https://xero.com/pricing",
      "careers_url": "https://xero.com/careers",
      "created_at": "2026-06-01T12:00:00.000Z"
    }
  ]
}`}
        />

        <Endpoint
          method="GET"
          path="/api/v1/competitors/:id"
          description="A single competitor, including its fact sheet (why you tend to win or lose deals against them, if generated)."
          example={`curl https://www.ripplewatch.ai/api/v1/competitors/b3f1... \\
  -H "Authorization: Bearer rw_live_..."`}
          response={`{
  "data": {
    "id": "b3f1...",
    "name": "Xero",
    "domain": "xero.com",
    "category": "Accounting software",
    "pricing_url": "https://xero.com/pricing",
    "careers_url": "https://xero.com/careers",
    "fact_sheet_why_we_win": "...",
    "fact_sheet_why_we_lose": "...",
    "fact_sheet_generated_at": "2026-08-01T09:00:00.000Z",
    "created_at": "2026-06-01T12:00:00.000Z"
  }
}`}
        />

        <Endpoint
          method="GET"
          path="/api/v1/signals"
          description="Scored and unscored signals across your competitors, newest first. Every field the dashboard shows for a signal is here, plus the competitor's name so you don't need a second lookup."
          params={
            <>
              <Param name="competitor_id" type="uuid">
                Limit to one competitor. Ignored (returns an empty list) if it isn&apos;t one of yours.
              </Param>
              <Param name="type" type="string">
                One of <code>pricing</code>, <code>job_posting</code>, <code>review</code>, <code>news</code>,{" "}
                <code>funding</code>, <code>seo</code>, <code>product_change</code>.
              </Param>
              <Param name="relevance_level" type="string">
                One of <code>High</code>, <code>Medium</code>, <code>Low</code>.
              </Param>
              <Param name="since" type="date, YYYY-MM-DD">
                Only signals that occurred on or after this date.
              </Param>
              <Param name="limit" type="integer">
                Default 50, max 100.
              </Param>
              <Param name="offset" type="integer">
                Default 0, for paging past <code>limit</code>.
              </Param>
            </>
          }
          example={`curl "https://www.ripplewatch.ai/api/v1/signals?relevance_level=High&limit=20" \\
  -H "Authorization: Bearer rw_live_..."`}
          response={`{
  "data": [
    {
      "id": "9a2c...",
      "competitor_id": "b3f1...",
      "competitor_name": "Xero",
      "type": "pricing",
      "title": "Xero raised its Growth plan from $69 to $79/mo",
      "summary": "Detected on Xero's pricing page.",
      "url": "https://xero.com/pricing",
      "occurred_on": "2026-08-20",
      "scored": true,
      "relevance_level": "High",
      "relevance_score": 82,
      "relevance_reasoning": "...",
      "source": "pipeline",
      "created_at": "2026-08-20T13:04:11.000Z"
    }
  ],
  "count": 143,
  "limit": 20,
  "offset": 0
}`}
        />

        <Endpoint
          method="GET"
          path="/api/v1/trends"
          description="Recurring win/loss themes identified across every logged win/loss reason, most-supported first, with any real tracked signals they connect to. Empty until you've generated trends at least once from the dashboard's Win/loss section."
          example={`curl https://www.ripplewatch.ai/api/v1/trends \\
  -H "Authorization: Bearer rw_live_..."`}
          response={`{
  "data": [
    {
      "id": "e71a...",
      "theme": "Price sensitivity",
      "summary": "Deals are being lost on price more than any other factor.",
      "won_count": 2,
      "lost_count": 7,
      "example_reasons": ["Went with the cheaper option", "Price was the deciding factor"],
      "related_signals": [
        { "signalId": "9a2c...", "relationNote": "Xero's recent price hike likely widened this gap." }
      ],
      "generated_at": "2026-08-18T10:00:00.000Z"
    }
  ]
}`}
        />

        <Endpoint
          method="GET"
          path="/api/v1/momentum"
          description="A momentum score and label (e.g. Heating up, Steady, Cooling) for every tracked competitor, computed from hiring, pricing, sentiment-weighted press/funding coverage, and win/loss trend. Deterministic — no LLM cost, safe to poll."
          example={`curl https://www.ripplewatch.ai/api/v1/momentum \\
  -H "Authorization: Bearer rw_live_..."`}
          response={`{
  "data": [
    { "competitor_id": "b3f1...", "competitor_name": "Xero", "score": 42, "label": "Heating up" }
  ]
}`}
        />

        <Endpoint
          method="GET"
          path="/api/v1/verdict"
          description="This week's synthesized takeaway — the same one-paragraph summary shown at the top of the dashboard — if one has been generated in the last 8 days. Returns null fields once it goes stale rather than serving week-old context as current."
          example={`curl https://www.ripplewatch.ai/api/v1/verdict \\
  -H "Authorization: Bearer rw_live_..."`}
          response={`{
  "data": {
    "verdict": "Xero's price increase is your best opening this week...",
    "generated_at": "2026-08-24T12:00:00.000Z"
  }
}`}
        />

        <Endpoint
          method="POST"
          path="/api/v1/win-loss"
          description="Push a single deal outcome in the moment it closes, instead of batch-exporting a CSV later. Matches competitor_name case-insensitively against your tracked competitors; a name that doesn't match becomes a suggested competitor instead of being rejected. Updates that competitor's Momentum win-rate trend immediately, returned in the response."
          params={
            <>
              <Param name="competitor_name" type="string, required">
                Matched case-insensitively against your tracked competitors.
              </Param>
              <Param name="outcome" type="string, required">
                One of <code>won</code>, <code>lost</code>.
              </Param>
              <Param name="reason" type="string">
                Optional free text — why the deal went that way.
              </Param>
            </>
          }
          example={`curl -X POST https://www.ripplewatch.ai/api/v1/win-loss \\
  -H "Authorization: Bearer rw_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"competitor_name": "Xero", "outcome": "lost", "reason": "Price was the deciding factor"}'`}
          response={`{
  "matched": true,
  "imported": 1,
  "skipped": 0,
  "suggestedCompetitors": [],
  "momentum": { "score": 24, "label": "Heating up" }
}`}
        />
      </div>

      <h2>Email win/loss data in</h2>
      <p>
        No integration or script needed: on Plus/Advanced plans, Settings → Developer shows a personal address of
        the form <code>winloss+&lt;accountId&gt;@in.ripplewatch.ai</code>. Forward a &quot;we lost this deal&quot;
        email there, or CC it from your CRM&apos;s outcome notification, and it runs through the same extraction
        pipeline as a CSV import — matched against your tracked competitors, or added as a suggested competitor if
        it isn&apos;t one yet.
      </p>

      <h2>Response shape</h2>
      <p>
        Every endpoint returns <code>{"{ data: ... }"}</code>: an array for list endpoints, an object for single
        resources. <code>/api/v1/signals</code> additionally returns <code>count</code> (the total matching rows,
        not just this page), <code>limit</code>, and <code>offset</code>.
      </p>

      <h2>Errors</h2>
      <p>Errors return <code>{"{ error: string }"}</code> with one of these statuses:</p>
      <ul>
        <li><code>401</code> — missing, malformed, or revoked API key.</li>
        <li><code>403</code> — the key&apos;s account isn&apos;t on Plus or Advanced (API access is gated by plan, checked on every request, not just at key creation).</li>
        <li><code>404</code> — resource not found, or not owned by your account.</li>
        <li><code>429</code> — rate limit exceeded (60 requests/minute per key). Retry after a few seconds.</li>
        <li><code>500</code> — something went wrong on our end.</li>
      </ul>
    </LegalDoc>
  );
}
