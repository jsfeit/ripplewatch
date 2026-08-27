import { Calendar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMO_URL } from "@/lib/demo";

// One shared "Book a demo" link so the Calendly URL and its styling live in
// one place instead of being copy-pasted at every CTA site. "text" matches
// the low-key muted-link treatment used as a secondary nudge next to a
// primary button; "button" renders it as an actual outline button for spots
// where it should carry equal visual weight to the primary CTA.
export function DemoLink({
  variant = "text",
  label = "Book a demo",
  className,
}: {
  variant?: "text" | "button";
  label?: string;
  className?: string;
}) {
  if (variant === "button") {
    return (
      <a
        href={DEMO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline" }), className)}
      >
        <Calendar className="size-4" />
        {label}
      </a>
    );
  }

  return (
    <a
      href={DEMO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      <Calendar className="size-4" />
      {label}
    </a>
  );
}
