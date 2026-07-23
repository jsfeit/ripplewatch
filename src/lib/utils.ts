import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Deterministic avatar background per name, so the same competitor always
// gets the same color and the list reads as visually distinct at a glance
// instead of a wall of identical gray circles.
const AVATAR_PALETTE = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/20 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
];

const DOT_PALETTE = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function seedIndex(seed: string, paletteLength: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % paletteLength;
}

export function avatarColor(seed: string): string {
  return AVATAR_PALETTE[seedIndex(seed, AVATAR_PALETTE.length)];
}

// Solid version of avatarColor for small indicators (dots, chip markers)
// where the tinted background variant would be too subtle to read.
export function avatarDotColor(seed: string): string {
  return DOT_PALETTE[seedIndex(seed, DOT_PALETTE.length)];
}
