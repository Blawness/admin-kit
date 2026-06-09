import { generateRssXml } from "@blawness/admin-kit/public";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

export async function GET() {
  const xml = await generateRssXml({
    siteUrl: SITE_URL,
    title: "Admin Kit Demo — Berita",
    description: "Artikel terbaru dari demo admin-kit",
    articleBasePath: "/berita",
    feedPath: "/rss.xml",
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
