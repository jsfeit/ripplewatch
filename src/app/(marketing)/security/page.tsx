import { LegalDoc } from "@/components/marketing/legal-doc";
import { CORE_SUBPROCESSORS, SubprocessorTable } from "@/components/marketing/subprocessor-table";

const description =
  "What Ripplewatch can see, what a connected AI assistant can and can't do, how your data is protected, and who handles it.";

export const metadata = {
  title: "Security",
  description,
  alternates: { canonical: "/security" },
  openGraph: { title: "Security | Ripplewatch", description, images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: "Security | Ripplewatch", description, images: ["/opengraph-image"] },
};

export default function SecurityPage() {
  return (
    <LegalDoc title="Security" updated="October 27, 2026">
      <p className="text-muted-foreground">
        Ripplewatch holds your competitors, your positioning and the reasons you win and lose deals. That is
        sensitive, so here is plainly what we do with it. We don&apos;t have a SOC 2 report today, and this page
        only states what is true now.
      </p>

      <section>
        <h2>What a connected AI assistant can and can&apos;t do</h2>
        <p>When you connect Claude, ChatGPT or another assistant, you sign in and approve it. Once approved, it can:</p>
        <ul>
          <li>Read your competitors, momentum scores, signals and trends.</li>
          <li>Ask questions that are answered against your positioning and ideal customer profile.</li>
          <li>Add competitors, and log won and lost deals and customer feedback you tell it about.</li>
        </ul>
        <p>
          It can&apos;t change billing or team settings. You can see every connected app and disconnect it any time in
          Settings, under Developer. Disconnecting revokes its access.
        </p>
      </section>

      <section>
        <h2>Who can see your data</h2>
        <ul>
          <li>Each account&apos;s data is kept separate at the database level, so one customer can&apos;t see another&apos;s competitors, signals or business context.</li>
          <li>We don&apos;t sell your data, to anyone, for any reason.</li>
          <li>Your data isn&apos;t used to train AI models. Relevant parts of your business context and competitor signals are sent to Anthropic&apos;s Claude models per request to produce your scores and answers. Anthropic doesn&apos;t train on them, and our terms with Anthropic provide zero data retention, so they don&apos;t keep those requests after processing.</li>
        </ul>
      </section>

      <section>
        <h2>Encryption and payments</h2>
        <ul>
          <li>Everything travels over HTTPS/TLS.</li>
          <li>Data is encrypted at rest in our database using our provider&apos;s standard AES-256 encryption.</li>
          <li>We never see or store your card number. Stripe handles all card processing on their own PCI-compliant systems.</li>
        </ul>
      </section>

      <section>
        <h2>Sign-in and keys</h2>
        <ul>
          <li>Connecting an assistant uses an OAuth sign-in that you approve on a screen showing which app is asking and where it will send you back.</li>
          <li>Passwords are handled by our authentication provider. We don&apos;t keep them in readable form.</li>
          <li>If you connect with an API key instead, the key is shown to you once. We store only a SHA-256 hash of it, and you can revoke it in Settings.</li>
        </ul>
      </section>

      <section>
        <h2>Who handles your data</h2>
        <p>
          These are the vendors that process data to run Ripplewatch. Optional integrations, such as Slack, HubSpot,
          Gong and Zoom, only process your data if you connect them. See the{" "}
          <a href="/terms#subprocessors">full subprocessor list</a>.
        </p>
        <SubprocessorTable rows={CORE_SUBPROCESSORS} />
        <p>
          If your company needs a signed Data Processing Addendum, email{" "}
          <a href="mailto:hello@ripplewatch.ai">hello@ripplewatch.ai</a> and we&apos;ll send one.
        </p>
      </section>

      <section>
        <h2>Your data, your call</h2>
        <ul>
          <li>You can ask for an export or deletion of your data at any time at <a href="mailto:hello@ripplewatch.ai">hello@ripplewatch.ai</a>.</li>
          <li>If you cancel, we keep your data for 30 days in case you come back, email you a week before it is deleted, and then delete it. We delete it sooner if you ask.</li>
          <li>Our <a href="/privacy">Privacy Policy</a> has the full detail.</li>
        </ul>
      </section>

      <section>
        <h2>Found a problem?</h2>
        <p>
          Email <a href="mailto:security@ripplewatch.ai">security@ripplewatch.ai</a> with what you found and we&apos;ll
          look at it promptly and tell you what we did.
        </p>
      </section>
    </LegalDoc>
  );
}
