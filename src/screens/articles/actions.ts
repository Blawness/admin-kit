"use server";

import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireUser, requireAdmin } from "../../lib/auth-helpers";
import {
  createArticle,
  updateArticle,
  submitForReview,
  publishArticle,
  rejectArticle,
  deleteArticle,
} from "../../lib/admin/articles";
import { sanitizeHtml } from "../../lib/sanitize";
import { isUniqueViolation } from "../../lib/db-errors";
import { ARTICLES_TAG } from "../../lib/cache-tags";
import { logAudit } from "../../lib/audit";

const articleSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  slug: z
    .string()
    .min(1, "Slug wajib diisi")
    .max(80, "Slug maksimal 80 karakter")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug hanya boleh huruf kecil, angka, dan tanda hubung (tanpa diawali/diakhiri tanda hubung)"
    ),
  content: z.string().optional(),
  coverImageUrl: z.string().optional(),
  // Optional SEO/discoverability fields — empty strings normalize to undefined
  // so the DB stores NULL rather than "".
  excerpt: emptyToUndefined(z.string().max(300, "Ringkasan maksimal 300 karakter")),
  metaTitle: emptyToUndefined(z.string().max(70, "Meta title maksimal 70 karakter")),
  metaDescription: emptyToUndefined(z.string().max(200, "Meta description maksimal 200 karakter")),
  ogImage: emptyToUndefined(z.string()),
});

/** Treat blank/whitespace input as "not provided" (→ undefined → NULL). */
function emptyToUndefined(schema: z.ZodString) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema.optional(),
  );
}

function parseTagIds(fd: FormData): number[] {
  return fd
    .getAll("tagIds")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
}

function parseCategoryId(fd: FormData): number | null {
  const raw = fd.get("categoryId");
  if (!raw || raw === "") return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
}

export async function createArticleAction(fd: FormData) {
  const session = await requireUser();
  const intent = fd.get("intent") as "draft" | "review";

  const parsed = articleSchema.safeParse({
    title: fd.get("title"),
    slug: fd.get("slug"),
    content: fd.get("content"),
    coverImageUrl: fd.get("coverImageUrl"),
  });

  if (!parsed.success) {
    const msg = encodeURIComponent(parsed.error.issues[0].message);
    redirect(`/admin/articles/new?error=${msg}`);
  }

  const { content, ...rest } = parsed.data;
  const sanitized = content ? sanitizeHtml(content) : undefined;

  let articleId!: number;
  try {
    const article = await createArticle(
      { ...rest, content: sanitized, categoryId: parseCategoryId(fd), tagIds: parseTagIds(fd) },
      Number(session.user.id)
    );
    articleId = article.id;
    logAudit({
      actorId: Number(session.user.id),
      action: "article.create",
      entityType: "article",
      entityId: articleId,
    }).catch(() => {});
  } catch (e) {
    const msg = isUniqueViolation(e) ? "Slug sudah digunakan." : "Gagal membuat artikel.";
    redirect(`/admin/articles/new?error=${encodeURIComponent(msg)}`);
  }

  // Revalidasi cache publik agar konsumen yang menandai layer baca dengan
  // "articles" mendapat data terbaru.
  revalidateTag(ARTICLES_TAG, "max");

  if (intent === "review") {
    try {
      await submitForReview(articleId, Number(session.user.id));
      logAudit({
        actorId: Number(session.user.id),
        action: "article.submit",
        entityType: "article",
        entityId: articleId,
      }).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengajukan review.";
      redirect(`/admin/articles/edit?id=${articleId}&error=${encodeURIComponent(msg)}`);
    }
  }

  redirect("/admin/articles");
}

export async function updateArticleAction(fd: FormData) {
  const session = await requireUser();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  const intent = fd.get("intent") as "draft" | "review";

  const parsed = articleSchema.safeParse({
    title: fd.get("title"),
    slug: fd.get("slug"),
    content: fd.get("content"),
    coverImageUrl: fd.get("coverImageUrl"),
  });

  if (!parsed.success) {
    const msg = encodeURIComponent(parsed.error.issues[0].message);
    redirect(`/admin/articles/edit?id=${id}&error=${msg}`);
  }

  const { content, ...rest } = parsed.data;
  const sanitized = content ? sanitizeHtml(content) : undefined;

  try {
    await updateArticle(
      id,
      { ...rest, content: sanitized, categoryId: parseCategoryId(fd), tagIds: parseTagIds(fd) },
      { userId: Number(session.user.id), isAdmin: session.user.role === "admin" }
    );
    logAudit({
      actorId: Number(session.user.id),
      action: "article.update",
      entityType: "article",
      entityId: id,
    }).catch(() => {});
  } catch (e) {
    const msg = isUniqueViolation(e)
      ? "Slug sudah digunakan."
      : e instanceof Error
        ? e.message
        : "Gagal menyimpan artikel.";
    redirect(`/admin/articles/edit?id=${id}&error=${encodeURIComponent(msg)}`);
  }

  // Revalidasi cache publik agar perubahan terlihat oleh konsumen.
  revalidateTag(ARTICLES_TAG, "max");

  if (intent === "review") {
    try {
      await submitForReview(id, Number(session.user.id));
      logAudit({
        actorId: Number(session.user.id),
        action: "article.submit",
        entityType: "article",
        entityId: id,
      }).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengajukan review.";
      redirect(`/admin/articles/edit?id=${id}&error=${encodeURIComponent(msg)}`);
    }
  }

  redirect("/admin/articles");
}

export async function publishArticleAction(fd: FormData) {
  const session = await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  try {
    await publishArticle(id);
    logAudit({
      actorId: Number(session.user.id),
      action: "article.publish",
      entityType: "article",
      entityId: id,
    }).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mempublikasi artikel.";
    redirect(`/admin/articles?error=${encodeURIComponent(msg)}`);
  }
  // Revalidasi cache publik agar artikel yang dipublikasi tampil di konsumen.
  revalidateTag(ARTICLES_TAG, "max");
  redirect("/admin/articles");
}

export async function rejectArticleAction(fd: FormData) {
  const session = await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  try {
    await rejectArticle(id);
    logAudit({
      actorId: Number(session.user.id),
      action: "article.reject",
      entityType: "article",
      entityId: id,
    }).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menolak artikel.";
    redirect(`/admin/articles?error=${encodeURIComponent(msg)}`);
  }
  // Revalidasi cache publik.
  revalidateTag(ARTICLES_TAG, "max");
  redirect("/admin/articles");
}

export async function deleteArticleAction(fd: FormData) {
  const session = await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  await deleteArticle(id);
  logAudit({
    actorId: Number(session.user.id),
    action: "article.delete",
    entityType: "article",
    entityId: id,
  }).catch(() => {});
  // Revalidasi cache publik agar artikel yang dihapus hilang dari konsumen.
  revalidateTag(ARTICLES_TAG, "max");
  redirect("/admin/articles");
}
