import type { Metadata } from "next";

// Search results cut a title off at about 60 characters, and the site-wide template adds
// " | Ripplewatch" (14). A title that would run past that goes in on its own instead, so
// the words that matter (the competitor, the question) aren't what gets clipped.
const TEMPLATE_SUFFIX = " | Ripplewatch";
const MAX_TITLE = 60;

export function fitTitle(base: string): Metadata["title"] {
  return base.length + TEMPLATE_SUFFIX.length > MAX_TITLE ? { absolute: base } : base;
}
