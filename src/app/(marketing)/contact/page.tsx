import { ContactForm } from "@/components/marketing/contact-form";

const description = "Send Ripplewatch a question, ask for help with your account, or book a demo.";

export const metadata = {
  title: "Contact us",
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact us | Ripplewatch", description },
  twitter: { card: "summary_large_image", title: "Contact us | Ripplewatch", description },
};

// Static on purpose: reading ?topic= on the server made every visit render on demand (0.3 to 1.1 s).
// The form reads it in the browser instead, so the page itself can be served from the cache.
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
        <p className="mt-3 text-muted-foreground">
          Questions, account help, or a walkthrough. It comes straight to us and we reply by email.
        </p>
      </div>
      <div className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
