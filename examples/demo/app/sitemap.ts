import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@blawness/admin-kit/public";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries({
    siteUrl: SITE_URL,
    articleBasePath: "/berita",
  });
  return [
    { url: SITE_URL, lastModified: new Date() },
    { url: `${SITE_URL}/berita`, lastModified: new Date() },
    ...entries,
  ];
}
