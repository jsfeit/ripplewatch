import { ContactForm } from "@/components/marketing/contact-form";
import { CONTACT_TOPICS, type ContactTopicId } from "@/lib/contact-topics";

const description = "Send Ripplewatch a question, ask for help with your account, or book a demo.";

export const metadata = {
  title: "Contact us",
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact us | Ripplewatch", description },
  twitter: { card: "summary_large_image", title: "Contact us | Ripplewatch", description },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const initialTopic: ContactTopicId = CONTACT_TOPICS.some((t) => t.id === topic) ? (topic as ContactTopicId) : "question";
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
        <p className="mt-3 text-muted-foreground">
          Questions, account help, or a walkthrough. It comes straight to us and we reply by email.
        </p>
      </div>
      <div className="mt-10">
        <ContactForm initialTopic={initialTopic} />
      </div>
    </div>
  );
}
