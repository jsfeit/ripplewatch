"use client";

import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import type { FaqCategory } from "@/lib/faq";

export function FaqAccordion({ categories }: { categories: FaqCategory[] }) {
  return (
    <Accordion
      multiple
      defaultValue={categories.map((c) => c.title)}
      className="mt-14 divide-y divide-border border-y border-border"
    >
      {categories.map((category) => (
        <AccordionItem key={category.title} value={category.title} className="border-b-0">
          <AccordionTrigger className="text-base font-semibold sm:text-lg">
            {category.title}
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-6">
              {category.items.map((item) => (
                <div key={item.question}>
                  <h3 className="font-medium">{item.question}</h3>
                  <p
                    className="mt-1.5 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
                    dangerouslySetInnerHTML={{ __html: item.answer }}
                  />
                </div>
              ))}
            </div>
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
