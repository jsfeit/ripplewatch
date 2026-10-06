import { CONNECT_QUICK_ANSWERS } from "@/lib/connect";
import { CONNECT_BASE_FEE_USD, CONNECT_MIN_FUNDING_USD } from "@/lib/connect-pricing";

// Short, quotable answers near the top of the page. Plain text in a
// definition list on purpose: it's what a search engine or an AI assistant
// lifts when someone asks "what is Ripplewatch" or "how much does it cost".
export function QuickAnswers() {
  const items = [
    ...CONNECT_QUICK_ANSWERS,
    {
      question: "What does it cost?",
      answer: `$${CONNECT_BASE_FEE_USD} a month plus usage you prepay for, starting at $${CONNECT_MIN_FUNDING_USD}. Answers and each competitor you watch draw from that balance. The platform fee and any unused balance are refundable within 30 days.`,
    },
  ];
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h2 className="text-xl font-semibold tracking-tight">Quick answers</h2>
        <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.question}>
              <dt className="text-sm font-medium">{item.question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
