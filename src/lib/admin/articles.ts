import { eq, desc, and, type SQL } from "drizzle-orm";
import { db } from "../../db/index";
import { articles, users, categories, tags, articleTags } from "../../db/schema";

export type ArticleStatus = "draft" | "pending_review" | "published";

export async function listArticles(filters?: {
  status?: ArticleStatus;
  authorId?: number;
}) {
  const conditions: SQL[] = [];
  if (filters?.status) conditions.push(eq(articles.status, filters.status));
  if (filters?.authorId !== undefined)
    conditions.push(eq(articles.authorId, filters.authorId));

  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      status: articles.status,
      coverImageUrl: articles.coverImageUrl,
      authorId: articles.authorId,
      authorName: users.name,
      categoryId: articles.categoryId,
      categoryName: categories.name,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(desc(articles.createdAt));
}

export async function getArticleById(id: number) {
  const [row] = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      content: articles.content,
      coverImageUrl: articles.coverImageUrl,
      status: articles.status,
      categoryId: articles.categoryId,
      categoryName: categories.name,
      authorId: articles.authorId,
      authorName: users.name,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.id, id));

  if (!row) return null;

  const articleTagRows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(tags)
    .innerJoin(articleTags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, id));

  return { ...row, tags: articleTagRows };
}

export async function getArticleBySlug(slug: string) {
  const [row] = await db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      content: articles.content,
      coverImageUrl: articles.coverImageUrl,
      status: articles.status,
      categoryId: articles.categoryId,
      categoryName: categories.name,
      authorId: articles.authorId,
      authorName: users.name,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.slug, slug));

  if (!row) return null;

  const articleTagRows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(tags)
    .innerJoin(articleTags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, row.id));

  return { ...row, tags: articleTagRows };
}

export async function createArticle(
  data: {
    title: string;
    slug: string;
    content?: string;
    coverImageUrl?: string;
    categoryId?: number;
    tagIds?: number[];
  },
  authorId: number
) {
  return db.transaction(async (tx) => {
    const [article] = await tx
      .insert(articles)
      .values({
        title: data.title,
        slug: data.slug,
        content: data.content,
        coverImageUrl: data.coverImageUrl,
        categoryId: data.categoryId,
        authorId,
        status: "draft",
      })
      .returning({ id: articles.id });

    if (data.tagIds && data.tagIds.length > 0) {
      await tx
        .insert(articleTags)
        .values(data.tagIds.map((tagId) => ({ articleId: article.id, tagId })));
    }

    return article;
  });
}

export async function updateArticle(
  id: number,
  data: {
    title?: string;
    slug?: string;
    content?: string;
    coverImageUrl?: string;
    categoryId?: number | null;
    tagIds?: number[];
  },
  ctx: { userId: number; isAdmin: boolean }
) {
  const [existing] = await db
    .select({ authorId: articles.authorId })
    .from(articles)
    .where(eq(articles.id, id));
  if (!existing) throw new Error("Artikel tidak ditemukan.");
  if (!ctx.isAdmin && existing.authorId !== ctx.userId)
    throw new Error("Tidak diizinkan mengedit artikel ini.");

  await db.transaction(async (tx) => {
    await tx
      .update(articles)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
        ...("categoryId" in data && { categoryId: data.categoryId }),
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id));

    if (data.tagIds !== undefined) {
      await tx.delete(articleTags).where(eq(articleTags.articleId, id));
      if (data.tagIds.length > 0) {
        await tx
          .insert(articleTags)
          .values(data.tagIds.map((tagId) => ({ articleId: id, tagId })));
      }
    }
  });
}

export async function submitForReview(id: number, userId: number) {
  const existing = await getArticleById(id);
  if (!existing) throw new Error("Artikel tidak ditemukan.");
  if (existing.authorId !== userId) throw new Error("Tidak diizinkan.");
  if (existing.status === "published") throw new Error("Artikel yang sudah dipublikasi tidak dapat diajukan ulang.");
  const stripped = existing.content?.replace(/<[^>]+>/g, "").trim() ?? "";
  if (!stripped) throw new Error("Konten artikel tidak boleh kosong saat mengajukan review.");
  await db
    .update(articles)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(eq(articles.id, id));
}

export async function publishArticle(id: number) {
  await db
    .update(articles)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(articles.id, id));
}

export async function rejectArticle(id: number) {
  await db
    .update(articles)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(articles.id, id));
}

export async function deleteArticle(id: number) {
  await db.delete(articles).where(eq(articles.id, id));
}
