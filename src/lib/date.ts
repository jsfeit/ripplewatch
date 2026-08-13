// Relative-time and formatted-date helpers shared across the app and blog —
// previously copy-pasted (byte-identical in two places, a third divergent
// variant in a third) rather than imported from one place.

export function timeAgo(iso: string | null, opts?: { nullLabel?: string; prefix?: string }): string {
  if (!iso) return opts?.nullLabel ?? "never";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  const prefix = opts?.prefix ? `${opts.prefix} ` : "";
  if (days <= 0) return `${prefix}today`;
  if (days === 1) return `${prefix}1 day ago`;
  if (days < 30) return `${prefix}${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? `${prefix}1 month ago` : `${prefix}${months} months ago`;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
