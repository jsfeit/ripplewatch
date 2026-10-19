// Shared by the contact form and its API route so the two can't disagree.
export const CONTACT_TOPICS = [
  { id: "question", label: "A question about Ripplewatch Connect", messageOptional: false },
  { id: "support", label: "Help with my account or billing", messageOptional: false },
  { id: "demo", label: "Book a demo", messageOptional: true },
  { id: "press", label: "Press or partnerships", messageOptional: false },
  { id: "other", label: "Something else", messageOptional: false },
] as const;

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]["id"];
