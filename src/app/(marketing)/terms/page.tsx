import { LegalDoc } from "@/components/marketing/legal-doc";

export const metadata = { title: "Terms of Service — Ripplewatch" };

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="July 23, 2026">
      <p className="text-muted-foreground">
        These terms govern your use of ripplewatch.ai and the Ripplewatch application (&ldquo;Ripplewatch,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;). By creating an account or using the service, you agree to them. If you are agreeing on
        behalf of a company, you are confirming you have the authority to do so.
      </p>

      <section>
        <h2>1. The service</h2>
        <p>
          Ripplewatch monitors competitors you choose to track and uses AI to score how relevant each
          signal is to your business, based on context you provide (your positioning, ICP, and reasons
          deals were lost or customers churned). Some signals may also draw on data from integrations you
          connect yourself, such as Slack, HubSpot, Gong, or Zoom.
        </p>
      </section>

      <section>
        <h2>2. Accounts</h2>
        <p>
          You&apos;re responsible for keeping your account credentials secure and for all activity under your
          account. You agree to provide accurate information when you sign up and to keep it up to date.
        </p>
      </section>

      <section>
        <h2>3. Subscriptions, billing, and cancellation</h2>
        <p>
          Paid plans are billed through Stripe according to the plan and billing period you select at
          checkout. Subscriptions renew automatically each billing period unless canceled.
        </p>
        <ul>
          <li>You can request a full refund on any charge within 30 days of that charge — just email us.</li>
          <li>
            After that 30-day window, you can cancel at any time. Cancellation stops future billing, but
            takes effect at the end of your current billing period — we do not issue partial refunds for
            time remaining in a period you have already paid for.
          </li>
        </ul>
        <p>We may change our pricing going forward; we will give you notice before any change affects your active subscription.</p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use Ripplewatch for any unlawful purpose, or in a way that violates a third party&apos;s rights.</li>
          <li>Attempt to reverse-engineer, resell, or provide unauthorized third-party access to the service.</li>
          <li>Send abnormally high automated traffic to our public or authenticated endpoints in a way that degrades the service for others.</li>
          <li>Use the service to collect or process data on competitors in a manner that violates applicable law.</li>
        </ul>
      </section>

      <section>
        <h2>5. AI-generated content</h2>
        <p>
          Relevance scores, reasoning, summaries, competitor suggestions, and answers from the Ask feature
          are generated automatically by AI models. They&apos;re intended to help you prioritize your attention,
          not as a substitute for your own judgment. This output can be incomplete, outdated, or simply
          wrong, and it is not legal, financial, or professional advice. You&apos;re responsible for
          independently verifying anything material before acting on it.
        </p>
      </section>

      <section>
        <h2>6. Third-party integrations</h2>
        <p>
          If you connect Slack, HubSpot, Gong, Zoom, or any other third-party service, your use of that
          service remains subject to its own terms. We are not responsible for the availability, accuracy,
          or conduct of third-party services.
        </p>
      </section>

      <section>
        <h2>7. Intellectual property</h2>
        <p>
          We own Ripplewatch&apos;s software, design, and branding. You own the business information you input
          into the product (your positioning, ICP, notes, and uploaded documents), and you grant us a
          license to use it solely to provide and improve the service for you.
        </p>
      </section>

      <section>
        <h2>8. Termination</h2>
        <p>
          You can cancel your account at any time. We may suspend or terminate your access if you violate
          these terms, and we will make a reasonable effort to notify you first except where immediate
          suspension is warranted (for example, to protect the security of the service).
        </p>
      </section>

      <section>
        <h2>9. Disclaimer of warranties</h2>
        <p>
          Ripplewatch is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied, including
          any warranty of merchantability, fitness for a particular purpose, or uninterrupted or
          error-free operation.
        </p>
      </section>

      <section>
        <h2>10. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Ripplewatch will not be liable for any indirect, incidental,
          or consequential damages, and our total liability for any claim relating to the service is
          limited to the amount you paid us in the 12 months before the claim arose.
        </p>
      </section>

      <section>
        <h2>11. Governing law</h2>
        <p>
          These terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law
          principles. Any disputes will be resolved in the state or federal courts located in Delaware.
        </p>
      </section>

      <section>
        <h2>12. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. If we make material changes, we will update the date
          above and notify you by email or an in-app notice. Continued use of Ripplewatch after a change
          takes effect means you accept the updated terms.
        </p>
      </section>

      <section>
        <h2>13. Contact us</h2>
        <p>
          Questions about these terms? Reach us at{" "}
          <a href="mailto:hello@ripplewatch.ai">hello@ripplewatch.ai</a>.
        </p>
      </section>
    </LegalDoc>
  );
}
