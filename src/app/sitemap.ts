import type { MetadataRoute } from "next";
import { loadRegions } from "@/lib/data";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const regions = loadRegions();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/compare`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/projects`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/insights`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/policy`, changeFrequency: "weekly", priority: 0.8 },
  ];
  const regionPages: MetadataRoute.Sitemap = regions.map((r) => ({
    url: `${SITE_URL}/region/${encodeURIComponent(r.id)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [...staticPages, ...regionPages];
}
