import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { listSitemapData } from "@/lib/content/sitemap";
import { POLICY_ROUTES } from "@/components/nav-items";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://abdrahman.online").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // keeps the database out of `next build`
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/library`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/categories`, changeFrequency: "weekly", priority: 0.6 },
  ];
  try {
    const { items, cats, pages } = await listSitemapData(getDb());
    for (const i of items) {
      entries.push({
        url: `${SITE}/library/${encodeURIComponent(i.slug)}`,
        lastModified: i.updatedAt,
        priority: 0.8,
      });
    }
    for (const c of cats) {
      if (c.count > 0) entries.push({ url: `${SITE}/categories/${encodeURIComponent(c.slug)}` });
      for (const k of c.children) {
        if (k.count > 0) entries.push({ url: `${SITE}/categories/${encodeURIComponent(k.slug)}` });
      }
    }
    for (const p of pages) {
      const path = p.key === "about" ? "/about" : POLICY_ROUTES[p.key];
      if (path) entries.push({ url: `${SITE}${path}` });
    }
  } catch (err) {
    console.error("sitemap: database unavailable", err instanceof Error ? err.message : err);
  }
  return entries;
}
