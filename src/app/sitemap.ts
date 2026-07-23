import type { MetadataRoute } from "next";
import { COMPARISONS } from "@/lib/comparisons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
    { path: "/waitlist", priority: 0.7, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/state-of-competitive-intelligence", priority: 0.8, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    ...COMPARISONS.map((c) => ({
      path: `/compare/${c.slug}`,
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
  ];

  return routes.map((route) => ({
    url: `${APP_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
