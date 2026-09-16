"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FaqCategory } from "@/lib/faq";

// Flat, stable ids for the accordion (category + question, not array index —
// index-based ids would silently reassign to the wrong open item once
// filtering changes which rows are actually rendered).
const itemId = (category: string, question: string) => `${category}::${question}`;

export function FaqBrowser({ categories }: { categories: FaqCategory[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleCategories = useMemo(() => {
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          if (activeCategory && category.title !== activeCategory) return false;
          if (!normalizedQuery) return true;
          return (
            item.question.toLowerCase().includes(normalizedQuery) ||
            item.answer.toLowerCase().includes(normalizedQuery)
          );
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedQuery, activeCategory]);

  const totalResults = visibleCategories.reduce((sum, c) => sum + c.items.length, 0);
  const isFiltered = normalizedQuery.length > 0 || activeCategory !== null;

  return (
    <div className="mt-10">
      <div className="mx-auto max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            aria-label="Search frequently asked questions"
            className="h-11 rounded-full pl-9 pr-9 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeCategory === null
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.title}
              type="button"
              onClick={() => setActiveCategory(category.title === activeCategory ? null : category.title)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeCategory === category.title
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {category.title}
            </button>
          ))}
        </div>
      </div>

      {isFiltered && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {totalResults === 0
            ? `No questions match "${query}"`
            : `${totalResults} question${totalResults === 1 ? "" : "s"}`}
        </p>
      )}

      {totalResults === 0 && isFiltered ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          Try a different search, or{" "}
          <a href="mailto:hello@ripplewatch.ai" className="text-primary underline underline-offset-2">
            just ask us directly
          </a>
          .
        </div>
      ) : (
        <div className="mt-12 space-y-12">
          {visibleCategories.map((category) => (
            <div key={category.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {category.title}
              </h2>
              <Accordion multiple className="mt-3">
                {category.items.map((item) => (
                  <AccordionItem key={item.question} value={itemId(category.title, item.question)}>
                    <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
                    <AccordionPanel>
                      <p
                        className="text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
                        dangerouslySetInnerHTML={{ __html: item.answer }}
                      />
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
