"use server";

import { redirect } from "next/navigation";
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

const articleSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung"),
  content: z.string().optional(),
  coverImageUrl: z.string().optional(),
});

function parseTagIds(fd: FormData): number[] {
  return fd
    .getAll("tagIds")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
}

function parseCategoryId(fd: FormData): number | undefined {
  const raw = fd.get("categoryId");
  if (!raw || raw === "") return undefined;
  const n = Number(raw);
  return isNaN(n) ? undefined : n;
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
  } catch (e) {
    const isUniqueViolation = (e as { code?: string }).code === "23505";
    const msg = isUniqueViolation ? "Slug sudah digunakan." : "Gagal membuat artikel.";
    redirect(`/admin/articles/new?error=${encodeURIComponent(msg)}`);
  }

  if (intent === "review") {
    try {
      await submitForReview(articleId, Number(session.user.id));
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan artikel.";
    redirect(`/admin/articles/edit?id=${id}&error=${encodeURIComponent(msg)}`);
  }

  if (intent === "review") {
    try {
      await submitForReview(id, Number(session.user.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengajukan review.";
      redirect(`/admin/articles/edit?id=${id}&error=${encodeURIComponent(msg)}`);
    }
  }

  redirect("/admin/articles");
}

export async function publishArticleAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  await publishArticle(id);
  redirect("/admin/articles");
}

export async function rejectArticleAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  await rejectArticle(id);
  redirect("/admin/articles");
}

export async function deleteArticleAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  await deleteArticle(id);
  redirect("/admin/articles");
}
