import { cacheTag, cacheLife } from "next/cache";
import { eq, and, desc, type SQL } from "drizzle-orm";
import { db } from "../../db/index";
import { articles, users, categories, tags, articleTags } from "../../db/schema";
import { ARTICLES_TAG } from "../cache-tags";

/**
 * Cached, public read layer for *published* articles. Consumers render these on
 * their public site; every query is tagged with {@link ARTICLES_TAG} so the
 * admin mutations (which call `revalidateTag(ARTICLES_TAG)`) keep them fresh.
 *
 * Requires `cacheComponents: true` in the consumer's `next.config` — the
 * `use cache` directive only takes effect there. This module lives behind the
 * dedicated `@blawness/admin-kit/public` entry point so importing the rest of
 * the package never forces that flag.
 */

const PUBLISHED = eq(articles.status, "published");

export type PublishedArticleListItem = {
  id: number;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
};

/**
 * List published articles, newest first. Optionally filter by category slug and
 * page with `limit`/`offset`. Arguments become part of the cache key, so each
 * distinct page/filter is cached independently.
 */
export async function getPublishedArticles(opts?: {
  limit?: number;
  offset?: number;
  categorySlug?: string;
}): Promise<PublishedArticleListItem[]> {
  "use cache";
  cacheTag(ARTICLES_TAG);
  cacheLife("hours");

  const conditions: SQL[] = [PUBLISHED];
  if (opts?.categorySlug) conditions.push(eq(categories.slug, opts.categorySlug));

  const query = db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      coverImageUrl: articles.coverImageUrl,
      publishedAt: articles.publishedAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorName: users.name,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt))
    .$dynamic();

  if (opts?.limit !== undefined) query.limit(opts.limit);
  if (opts?.offset !== undefined) query.offset(opts.offset);

  return query;
}

/**
 * A single published article by slug, with its tags. Returns `null` if the slug
 * is unknown or the article isn't published.
 */
export async function getPublishedArticleBySlug(slug: string) {
  "use cache";
  cacheTag(ARTICLES_TAG);
  cacheLife("hours");

  const [row] = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      content: articles.content,
      coverImageUrl: articles.coverImageUrl,
      publishedAt: articles.publishedAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorName: users.name,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(PUBLISHED, eq(articles.slug, slug)))
    .limit(1);

  if (!row) return null;

  const articleTagRows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(tags)
    .innerJoin(articleTags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, row.id));

  return { ...row, tags: articleTagRows };
}

/**
 * Slugs of all published articles — handy for `generateStaticParams`.
 */
export async function getPublishedArticleSlugs(): Promise<string[]> {
  "use cache";
  cacheTag(ARTICLES_TAG);
  cacheLife("hours");

  const rows = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(PUBLISHED);
  return rows.map((r) => r.slug);
}
