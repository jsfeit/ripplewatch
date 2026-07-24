import { LegalDoc } from "@/components/marketing/legal-doc";

const description = "Third-party services Ripplewatch uses to process customer data, and how to request a DPA.";

export const metadata = {
  title: "Subprocessors",
  description,
  alternates: { canonical: "/subprocessors" },
  openGraph: { title: "Subprocessors — Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Subprocessors — Ripplewatch", description, images: ["/opengraph-image"] },
};

type Subprocessor = {
  name: string;
  purpose: string;
  data: string;
  location: string;
};

const CORE: Subprocessor[] = [
  { name: "Vercel", purpose: "Application hosting", data: "All data in transit to and from the app", location: "United States" },
  { name: "Supabase", purpose: "Database, authentication, file storage", data: "Account data, business context, uploaded documents", location: "United States" },
  { name: "Stripe", purpose: "Payment processing", data: "Billing details — we never see your full card number", location: "United States" },
  { name: "Anthropic", purpose: "AI processing (relevance scoring, suggestions, Ask)", data: "Business context and competitor signal text, sent per-request", location: "United States" },
  { name: "Resend", purpose: "Transactional email delivery", data: "Email address, alert and digest content", location: "United States" },
  { name: "Sentry", purpose: "Error tracking", data: "Technical error and request metadata — no card numbers or passwords", location: "United States" },
];

const OPTIONAL: Subprocessor[] = [
  { name: "Slack", purpose: "Alert delivery, only if you connect it", data: "Alert content posted to your chosen channel", location: "United States" },
  { name: "HubSpot", purpose: "CRM context, only if you connect it", data: "Closed-lost deal reasons (read-only)", location: "United States" },
  { name: "Gong", purpose: "Call intelligence, only if you connect it", data: "Competitor mentions scanned from call transcripts", location: "United States" },
  { name: "Zoom", purpose: "Call intelligence, only if you connect it", data: "Competitor mentions scanned from call transcripts", location: "United States" },
];

function SubprocessorTable({ rows }: { rows: Subprocessor[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Subprocessor</th>
            <th className="px-4 py-2.5 font-medium">Purpose</th>
            <th className="px-4 py-2.5 font-medium">Data processed</th>
            <th className="px-4 py-2.5 font-medium">Location</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-medium">{row.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.purpose}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.data}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SubprocessorsPage() {
  return (
    <LegalDoc title="Subprocessors" updated="July 24, 2026">
      <p className="text-muted-foreground">
        Ripplewatch uses a small number of third-party service providers (&ldquo;subprocessors&rdquo;) to run the
        product. Each one only processes the data described below, only for the purpose listed — see our{" "}
        <a href="/privacy">Privacy Policy</a> for the full picture of what we collect and why.
      </p>

      <section>
        <h2>Core infrastructure</h2>
        <p>Used to run Ripplewatch for every customer.</p>
        <SubprocessorTable rows={CORE} />
      </section>

      <section>
        <h2>Optional integrations</h2>
        <p>Only process your data if you choose to connect them in Settings.</p>
        <SubprocessorTable rows={OPTIONAL} />
      </section>

      <section>
        <h2>Changes to this list</h2>
        <p>
          If we add or remove a subprocessor, we&apos;ll update this page and notify customers on paid plans
          by email in advance where practical.
        </p>
      </section>

      <section>
        <h2>Data Processing Addendum</h2>
        <p>
          If your company requires a signed Data Processing Addendum (DPA) as part of your procurement or
          security review, email <a href="mailto:hello@ripplewatch.ai">hello@ripplewatch.ai</a> and we&apos;ll
          get one to you.
        </p>
      </section>
    </LegalDoc>
  );
}
