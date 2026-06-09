import { cacheTag, cacheLife } from "next/cache";
import { eq, desc, isNotNull, and } from "drizzle-orm";
import { db } from "../../db/index";
import { articles } from "../../db/schema";
import { ARTICLES_TAG } from "../cache-tags";
import { escapeXml } from "../xml";

/**
 * Sitemap & RSS generators for published articles. Both are cached and tagged
 * with {@link ARTICLES_TAG}, so admin mutations refresh them automatically.
 * Requires `cacheComponents: true` in the consumer (see `./articles`).
 */

const PUBLISHED = eq(articles.status, "published");

/** Join a base site URL and a path into a single absolute URL (no double `/`). */
function joinUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export type SitemapEntry = { url: string; lastModified: Date };

/**
 * Entries for every published article, shaped for a Next.js `app/sitemap.ts`
 * (`MetadataRoute.Sitemap`-compatible). `articleBasePath` is the public route
 * prefix for a single article (default `/berita`).
 */
export async function getSitemapEntries(opts: {
  siteUrl: string;
  articleBasePath?: string;
}): Promise<SitemapEntry[]> {
  "use cache";
  cacheTag(ARTICLES_TAG);
  cacheLife("hours");

  const base = opts.articleBasePath ?? "/berita";
  const rows = await db
    .select({
      slug: articles.slug,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(PUBLISHED)
    .orderBy(desc(articles.publishedAt));

  return rows.map((r) => ({
    url: joinUrl(opts.siteUrl, `${base}/${r.slug}`),
    lastModified: r.updatedAt ?? r.publishedAt ?? new Date(0),
  }));
}

/**
 * A complete RSS 2.0 document string for the latest published articles, ready to
 * serve from a route handler (`new Response(xml, { headers: { "Content-Type":
 * "application/rss+xml" } })`).
 */
export async function generateRssXml(opts: {
  siteUrl: string;
  title: string;
  description: string;
  /** Public route prefix for a single article (default `/berita`). */
  articleBasePath?: string;
  /** Absolute or site-relative path this feed is served at (default `/rss.xml`). */
  feedPath?: string;
  /** Max items in the feed (default 20). */
  limit?: number;
}): Promise<string> {
  "use cache";
  cacheTag(ARTICLES_TAG);
  cacheLife("hours");

  const base = opts.articleBasePath ?? "/berita";
  const feedUrl = joinUrl(opts.siteUrl, opts.feedPath ?? "/rss.xml");

  const rows = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      excerpt: articles.excerpt,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(and(PUBLISHED, isNotNull(articles.publishedAt)))
    .orderBy(desc(articles.publishedAt))
    .limit(opts.limit ?? 20);

  const lastBuildDate = (rows[0]?.publishedAt ?? new Date(0)).toUTCString();

  const items = rows
    .map((r) => {
      const link = joinUrl(opts.siteUrl, `${base}/${r.slug}`);
      const pubDate = (r.publishedAt ?? new Date(0)).toUTCString();
      return [
        "    <item>",
        `      <title>${escapeXml(r.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        r.excerpt ? `      <description>${escapeXml(r.excerpt)}</description>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(opts.title)}</title>`,
    `    <link>${escapeXml(opts.siteUrl)}</link>`,
    `    <description>${escapeXml(opts.description)}</description>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");
}
