type Subprocessor = {
  name: string;
  purpose: string;
  data: string;
  location: string;
};

export const CORE_SUBPROCESSORS: Subprocessor[] = [
  { name: "Vercel", purpose: "Application hosting", data: "All data in transit to and from the app", location: "United States" },
  { name: "Supabase", purpose: "Database, authentication, file storage", data: "Account data, business context, uploaded documents", location: "United States" },
  { name: "Stripe", purpose: "Payment processing", data: "Billing details; we never see your full card number", location: "United States" },
  { name: "Anthropic", purpose: "AI processing (relevance scoring, suggestions, Ask)", data: "Business context and competitor signal text, sent per-request", location: "United States" },
  { name: "Resend", purpose: "Transactional email delivery", data: "Email address, alert and digest content", location: "United States" },
  { name: "Sentry", purpose: "Error tracking", data: "Technical error and request metadata, no card numbers or passwords", location: "United States" },
];

export const OPTIONAL_SUBPROCESSORS: Subprocessor[] = [
  { name: "Slack", purpose: "Alert delivery, only if you connect it", data: "Alert content posted to your chosen channel", location: "United States" },
  { name: "HubSpot", purpose: "CRM context, only if you connect it", data: "Closed-lost deal reasons (read-only)", location: "United States" },
  { name: "Gong", purpose: "Call intelligence, only if you connect it", data: "Competitor mentions scanned from call transcripts", location: "United States" },
  { name: "Zoom", purpose: "Call intelligence, only if you connect it", data: "Competitor mentions scanned from call transcripts", location: "United States" },
];

export function SubprocessorTable({ rows }: { rows: Subprocessor[] }) {
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
