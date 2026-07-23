import { LegalDoc } from "@/components/marketing/legal-doc";

export const metadata = { title: "Privacy Policy — Ripplewatch" };

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="July 23, 2026">
      <p className="text-muted-foreground">
        This policy explains what information Ripplewatch (&ldquo;Ripplewatch,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects through
        ripplewatch.ai and the Ripplewatch application, how we use it, and who we share it with. It&apos;s
        written for a US audience — if that changes as we grow internationally, we will update this policy
        accordingly.
      </p>

      <section>
        <h2>1. Information we collect</h2>
        <p>We collect information in a few different ways:</p>
        <ul>
          <li><strong>Account information</strong> you provide when you sign up: name, email, password (handled by our authentication provider), and company name.</li>
          <li><strong>Business context</strong> you give us during onboarding and in Settings: your positioning, ideal customer profile, and the reasons deals were lost or customers churned. This context is what powers relevance scoring — see Section 3.</li>
          <li><strong>The competitors you choose to track</strong>, and any documents you upload to help us understand your business.</li>
          <li><strong>Billing information</strong>, handled entirely by our payment processor, Stripe. We never see or store your full card number.</li>
          <li><strong>Integration data, only if you connect it</strong>: your Slack workspace (to deliver alerts), HubSpot CRM notes on closed-lost deals, and Gong/Zoom call transcripts (scanned only for competitor mentions). You can disconnect any of these at any time in Settings, which stops further access.</li>
          <li><strong>Basic usage data</strong>: pages visited and actions taken within the app, used only to operate and troubleshoot the product. We do not run third-party advertising trackers, and we do not sell your personal information.</li>
        </ul>
      </section>

      <section>
        <h2>2. How we use this information</h2>
        <p>We use the information above to:</p>
        <ul>
          <li>Operate the core product: monitor the competitors you track and score signals against your business context.</li>
          <li>Deliver alerts by email and Slack, and respond to questions you ask through the Ask feature.</li>
          <li>Process payments and manage your subscription.</li>
          <li>Provide customer support and respond to your requests.</li>
          <li>Maintain the security and reliability of the service.</li>
        </ul>
      </section>

      <section>
        <h2>3. How AI processing works</h2>
        <p>
          Ripplewatch&apos;s relevance scoring, competitor suggestions, and Ask feature are powered by
          Anthropic&apos;s Claude models. To generate a relevance score, a summary, or an answer, we send the
          relevant portions of your business context (positioning, ICP, lost-deal and churn notes, and,
          where connected, sales-call mentions or CRM notes) along with the specific competitor signal or
          question to Anthropic&apos;s API for processing.
        </p>
        <p>
          We do not use your data to train Anthropic&apos;s models or our own beyond what&apos;s needed to generate
          your results. AI-generated output can be wrong or incomplete — see the disclaimer in our{" "}
          <a href="/terms">Terms of Service</a>.
        </p>
      </section>

      <section>
        <h2>4. Publicly available competitor information</h2>
        <p>
          Separately from your own data, we collect publicly available information about the competitors
          you choose to track — things like pricing pages, job postings, news coverage, and funding
          announcements. This is not personal data about you or your team.
        </p>
      </section>

      <section>
        <h2>5. Who we share information with</h2>
        <p>We use a small number of service providers to run Ripplewatch, each only for its specific purpose:</p>
        <ul>
          <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
          <li><strong>Stripe</strong> — payment processing.</li>
          <li><strong>Anthropic</strong> — AI processing (relevance scoring, suggestions, Ask).</li>
          <li><strong>Resend</strong> — transactional email delivery (alerts, invites).</li>
          <li><strong>Slack, HubSpot, Gong, Zoom</strong> — only if and when you connect them yourself.</li>
        </ul>
        <p>We do not sell your personal information to third parties, and we do not share it for advertising purposes.</p>
      </section>

      <section>
        <h2>6. Data retention</h2>
        <p>
          We keep your account and signal data for as long as your account is active. If you cancel, we
          retain your data for a limited period in case you&apos;d like to reactivate, and delete it sooner on
          request.
        </p>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>
          You can access, correct, export, or request deletion of your personal information at any time by
          contacting us at{" "}
          <a href="mailto:hello@ripplewatch.ai">hello@ripplewatch.ai</a>. If you are a California resident,
          you have rights under the CCPA to know what personal information we have collected about you and to
          request its deletion — the same contact works for that.
        </p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>
          We use industry-standard safeguards to protect your information, including encryption in
          transit and database-level access controls that keep each account&apos;s data isolated from every
          other account&apos;s. No method of storage or transmission is perfectly secure, so we cannot guarantee
          absolute security.
        </p>
      </section>

      <section>
        <h2>9. Children&apos;s privacy</h2>
        <p>
          Ripplewatch is a business product intended for use by working professionals and is not directed
          at children. We do not knowingly collect information from anyone under 18.
        </p>
      </section>

      <section>
        <h2>10. Changes to this policy</h2>
        <p>
          If we make material changes to this policy, we will update the date above and notify you by email
          or an in-app notice.
        </p>
      </section>

      <section>
        <h2>11. Contact us</h2>
        <p>
          Questions about this policy or your data? Reach us at{" "}
          <a href="mailto:hello@ripplewatch.ai">hello@ripplewatch.ai</a>.
        </p>
      </section>
    </LegalDoc>
  );
}
