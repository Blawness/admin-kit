# Articles Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully built-in articles feature to `@blawness/admin-kit` — schema, query layer, server actions, screens, and package exports — following the existing layered architecture.

**Architecture:** Schema additions in `src/db/schema.ts` → query helpers in `src/lib/admin/` → server actions in `src/screens/*/actions.ts` → Server Component screens in `src/screens/*/page.tsx` + `form.tsx`. The `ArticleForm` is a "use client" component that manages rich state (Editor, ImageUpload, tag toggles) and submits via a single `<form>` with an `intent` hidden field to differentiate "draft" vs "review". Consumer mounts screens at `/admin/articles`, `/admin/articles/new`, `/admin/articles/edit`, `/admin/categories`.

**Tech Stack:** Drizzle ORM v0.45, Next.js 16 server actions, NextAuth v5, Tiptap v3, Zod v4, Lucide React, Tailwind v4.

---

## File Map

**Modify:**
- `src/db/schema.ts` — add `categories`, `tags`, `articles`, `articleTags` tables
- `package.json` — add 7 new export paths, bump version to `0.3.0`

**Create:**
- `src/lib/admin/articles.ts` — query layer: list, get, create, update, publish, reject, delete
- `src/lib/admin/categories.ts` — query layer: list/create/delete categories and tags
- `src/screens/articles/actions.ts` — server actions: create, update, publish, reject, delete
- `src/screens/articles/page.tsx` — `ArticlesScreen` server component (list view)
- `src/screens/articles/article-form.tsx` — `ArticleForm` client component
- `src/screens/articles/form.tsx` — `ArticleFormScreen` server component wrapper
- `src/screens/categories/actions.ts` — server actions for category/tag CRUD
- `src/screens/categories/page.tsx` — `CategoriesScreen` server component

---

## Task 1: Schema — Add Tables

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Replace `src/db/schema.ts` with the full updated content**

```ts
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").default("editor"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  album: text("album"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content"),
  coverImageUrl: text("cover_image_url"),
  status: text("status").notNull().default("draft"),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  authorId: integer("author_id").notNull().references(() => users.id),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.tagId] })]
);
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add articles/categories/tags tables to schema"
```

---

## Task 2: Articles Query Layer

**Files:**
- Create: `src/lib/admin/articles.ts`

- [ ] **Step 1: Create `src/lib/admin/articles.ts`**

```ts
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
  const [article] = await db
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
    await db
      .insert(articleTags)
      .values(data.tagIds.map((tagId) => ({ articleId: article.id, tagId })));
  }

  return article;
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
  const existing = await getArticleById(id);
  if (!existing) throw new Error("Artikel tidak ditemukan.");
  if (!ctx.isAdmin && existing.authorId !== ctx.userId)
    throw new Error("Tidak diizinkan mengedit artikel ini.");

  await db
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
    await db.delete(articleTags).where(eq(articleTags.articleId, id));
    if (data.tagIds.length > 0) {
      await db
        .insert(articleTags)
        .values(data.tagIds.map((tagId) => ({ articleId: id, tagId })));
    }
  }
}

export async function submitForReview(id: number, userId: number) {
  const existing = await getArticleById(id);
  if (!existing) throw new Error("Artikel tidak ditemukan.");
  if (existing.authorId !== userId) throw new Error("Tidak diizinkan.");
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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/articles.ts
git commit -m "feat: add articles query layer"
```

---

## Task 3: Categories Query Layer

**Files:**
- Create: `src/lib/admin/categories.ts`

- [ ] **Step 1: Create `src/lib/admin/categories.ts`**

```ts
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { categories, tags } from "../../db/schema";
import { slugify } from "../slug";

export async function listCategories() {
  return db.select().from(categories).orderBy(categories.name);
}

export async function createCategory(name: string) {
  const [row] = await db
    .insert(categories)
    .values({ name, slug: slugify(name) })
    .returning({ id: categories.id });
  return row;
}

export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id));
}

export async function listTags() {
  return db.select().from(tags).orderBy(tags.name);
}

export async function createTag(name: string) {
  const [row] = await db
    .insert(tags)
    .values({ name, slug: slugify(name) })
    .returning({ id: tags.id });
  return row;
}

export async function deleteTag(id: number) {
  await db.delete(tags).where(eq(tags.id, id));
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/categories.ts
git commit -m "feat: add categories/tags query layer"
```

---

## Task 4: Article Server Actions

**Files:**
- Create: `src/screens/articles/actions.ts`

Actions use a single `intent` field (`"draft"` | `"review"`) on create/update to decide whether to also submit for review after saving.

- [ ] **Step 1: Create `src/screens/articles/actions.ts`**

```ts
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

  let articleId: number;
  try {
    const article = await createArticle(
      { ...rest, content: sanitized, categoryId: parseCategoryId(fd), tagIds: parseTagIds(fd) },
      Number(session.user.id)
    );
    articleId = article.id;
  } catch {
    redirect(`/admin/articles/new?error=${encodeURIComponent("Slug sudah digunakan.")}`);
  }

  if (intent === "review") {
    try {
      await submitForReview(articleId!, Number(session.user.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengajukan review.";
      redirect(`/admin/articles/edit?id=${articleId!}&error=${encodeURIComponent(msg)}`);
    }
  }

  redirect("/admin/articles");
}

export async function updateArticleAction(fd: FormData) {
  const session = await requireUser();
  const id = Number(fd.get("id"));
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
  await publishArticle(Number(fd.get("id")));
  redirect("/admin/articles");
}

export async function rejectArticleAction(fd: FormData) {
  await requireAdmin();
  await rejectArticle(Number(fd.get("id")));
  redirect("/admin/articles");
}

export async function deleteArticleAction(fd: FormData) {
  await requireAdmin();
  await deleteArticle(Number(fd.get("id")));
  redirect("/admin/articles");
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/articles/actions.ts
git commit -m "feat: add article server actions"
```

---

## Task 5: Category/Tag Server Actions

**Files:**
- Create: `src/screens/categories/actions.ts`

- [ ] **Step 1: Create `src/screens/categories/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "../../lib/auth-helpers";
import {
  createCategory,
  deleteCategory,
  createTag,
  deleteTag,
} from "../../lib/admin/categories";

const nameSchema = z.string().min(1, "Nama tidak boleh kosong").max(100);

export async function createCategoryAction(fd: FormData) {
  await requireAdmin();
  const result = nameSchema.safeParse(fd.get("name"));
  if (!result.success) {
    redirect(`/admin/categories?error=${encodeURIComponent(result.error.issues[0].message)}`);
  }
  try {
    await createCategory(result.data);
  } catch {
    redirect(`/admin/categories?error=${encodeURIComponent("Kategori sudah ada.")}`);
  }
  redirect("/admin/categories");
}

export async function deleteCategoryAction(fd: FormData) {
  await requireAdmin();
  await deleteCategory(Number(fd.get("id")));
  redirect("/admin/categories");
}

export async function createTagAction(fd: FormData) {
  await requireAdmin();
  const result = nameSchema.safeParse(fd.get("name"));
  if (!result.success) {
    redirect(`/admin/categories?error=${encodeURIComponent(result.error.issues[0].message)}`);
  }
  try {
    await createTag(result.data);
  } catch {
    redirect(`/admin/categories?error=${encodeURIComponent("Tag sudah ada.")}`);
  }
  redirect("/admin/categories");
}

export async function deleteTagAction(fd: FormData) {
  await requireAdmin();
  await deleteTag(Number(fd.get("id")));
  redirect("/admin/categories");
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/categories/actions.ts
git commit -m "feat: add category/tag server actions"
```

---

## Task 6: ArticlesScreen (List View)

**Files:**
- Create: `src/screens/articles/page.tsx`

- [ ] **Step 1: Create `src/screens/articles/page.tsx`**

```tsx
import Link from "next/link";
import { requireUser } from "../../lib/auth-helpers";
import { listArticles, type ArticleStatus } from "../../lib/admin/articles";
import { ConfirmDelete } from "../../components/confirm-delete";
import { deleteArticleAction } from "./actions";
import { PlusCircle, AlertCircle, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Draft",
  pending_review: "Menunggu Review",
  published: "Published",
};

const STATUS_CLASSES: Record<ArticleStatus, string> = {
  draft: "bg-navy-100 text-navy-600 ring-navy-200",
  pending_review: "bg-gold-100 text-gold-700 ring-gold-200",
  published: "bg-brand-50 text-brand-700 ring-brand-100",
};

const FILTER_TABS: { label: string; value: ArticleStatus | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Menunggu Review", value: "pending_review" },
  { label: "Published", value: "published" },
];

const VALID_STATUSES = new Set<string>(["draft", "pending_review", "published"]);

export default async function ArticlesScreen({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const session = await requireUser();
  const { status, error } = await searchParams;
  const isAdmin = session.user.role === "admin";

  const validStatus =
    status && VALID_STATUSES.has(status) ? (status as ArticleStatus) : undefined;

  const items = await listArticles({
    status: validStatus,
    authorId: isAdmin ? undefined : Number(session.user.id),
  });

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-900">Artikel</h1>
          <p className="mt-1 text-sm text-muted-foreground">{items.length} artikel</p>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tulis Artikel
        </Link>
      </div>

      {error && (
        <p
          className="mb-4 flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value === "all"
                ? "/admin/articles"
                : `/admin/articles?status=${tab.value}`
            }
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              (tab.value === "all" && !validStatus) || tab.value === validStatus
                ? "bg-navy-900 text-white"
                : "text-navy-600 hover:bg-navy-100"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-navy-200 bg-white py-16 text-center">
          <FileText className="h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm font-medium text-navy-700">Belum ada artikel</p>
          <p className="text-xs text-muted-foreground">
            Mulai tulis artikel pertama.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-navy-50 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-900">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.authorName} · {item.categoryName ?? "Tanpa kategori"} ·{" "}
                  {new Date(item.createdAt!).toLocaleDateString("id-ID")}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_CLASSES[item.status as ArticleStatus]}`}
              >
                {STATUS_LABELS[item.status as ArticleStatus]}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/articles/edit?id=${item.id}`}
                  className="rounded-md border border-navy-200 px-2.5 py-1 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50"
                >
                  Edit
                </Link>
                {isAdmin && (
                  <ConfirmDelete
                    action={deleteArticleAction}
                    id={item.id}
                    title="Hapus artikel?"
                    description={
                      <>
                        Artikel{" "}
                        <span className="font-medium text-navy-900">{item.title}</span>{" "}
                        akan dihapus permanen.
                      </>
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/articles/page.tsx
git commit -m "feat: add ArticlesScreen list view"
```

---

## Task 7: ArticleForm Client Component

**Files:**
- Create: `src/screens/articles/article-form.tsx`

One `<form>` with two submit buttons (`name="intent" value="draft|review"`) so both save the full article data. Publish/reject are separate mini-forms that only need the article id.

- [ ] **Step 1: Create `src/screens/articles/article-form.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Editor } from "../../components/admin/editor";
import { ImageUpload } from "../../components/admin/image-upload";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { uploadImageAction } from "../media/actions";
import { slugify } from "../../lib/slug";
import { AlertCircle } from "lucide-react";
import type {
  createArticleAction,
  updateArticleAction,
  publishArticleAction,
  rejectArticleAction,
} from "./actions";

type Category = { id: number; name: string; slug: string };
type Tag = { id: number; name: string; slug: string };

export type ArticleFormProps = {
  mode: "create" | "edit";
  role: string;
  categories: Category[];
  availableTags: Tag[];
  error?: string;
  initial?: {
    id: number;
    title: string;
    slug: string;
    content: string | null;
    coverImageUrl: string | null;
    categoryId: number | null;
    tagIds: number[];
    status: string;
  };
  createAction: typeof createArticleAction;
  updateAction: typeof updateArticleAction;
  publishAction: typeof publishArticleAction;
  rejectAction: typeof rejectArticleAction;
};

export function ArticleForm({
  mode,
  role,
  categories,
  availableTags,
  error,
  initial,
  createAction,
  updateAction,
  publishAction,
  rejectAction,
}: ArticleFormProps) {
  const isAdmin = role === "admin";
  const isPendingReview = initial?.status === "pending_review";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [content, setContent] = useState(initial?.content ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? "");
  const [selectedTags, setSelectedTags] = useState<number[]>(initial?.tagIds ?? []);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  function toggleTag(id: number) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  const action = mode === "create" ? createAction : updateAction;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-bold text-navy-900">
        {mode === "create" ? "Tulis Artikel" : "Edit Artikel"}
      </h1>

      {error && (
        <p
          className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <form action={action} className="space-y-5">
        {/* Hidden fields managed by client state */}
        <input type="hidden" name="content" value={content} />
        <input type="hidden" name="coverImageUrl" value={coverImageUrl} />
        <input type="hidden" name="slug" value={slug} />
        {selectedTags.map((id) => (
          <input key={id} type="hidden" name="tagIds" value={id} />
        ))}
        {mode === "edit" && (
          <input type="hidden" name="id" value={initial?.id} />
        )}

        <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-sm space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy-700">Judul</label>
            <Input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul artikel"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy-700">Slug</label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="slug-artikel"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-navy-700">Kategori</label>
              <select
                name="categoryId"
                defaultValue={initial?.categoryId ?? ""}
                className="h-9 w-full rounded-md border border-navy-200 bg-white px-2.5 text-sm text-navy-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-navy-700">Tag</label>
              <div className="flex min-h-[36px] flex-wrap gap-1.5 rounded-md border border-navy-200 bg-white p-2">
                {availableTags.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Belum ada tag</span>
                ) : (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 transition-colors ${
                        selectedTags.includes(tag.id)
                          ? "bg-brand-600 text-white ring-brand-600"
                          : "bg-white text-navy-600 ring-navy-200 hover:bg-navy-50"
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy-700">Cover</label>
            <ImageUpload
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              uploadAction={uploadImageAction}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-navy-700">Konten</label>
            <Editor value={content} onChange={setContent} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="intent" value="draft" variant="outline">
            Simpan Draft
          </Button>
          <Button type="submit" name="intent" value="review">
            Ajukan Review
          </Button>
        </div>
      </form>

      {/* Admin-only publish/reject forms — only shown on pending_review articles */}
      {isAdmin && isPendingReview && (
        <div className="flex flex-wrap gap-2 border-t border-navy-100 pt-4">
          <form action={publishAction}>
            <input type="hidden" name="id" value={initial?.id} />
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
            >
              Publish
            </Button>
          </form>
          <form action={rejectAction}>
            <input type="hidden" name="id" value={initial?.id} />
            <Button
              type="submit"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              Tolak
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/articles/article-form.tsx
git commit -m "feat: add ArticleForm client component"
```

---

## Task 8: ArticleFormScreen Server Wrapper

**Files:**
- Create: `src/screens/articles/form.tsx`

Consumer mounts this at `/admin/articles/new` (no `id`) and `/admin/articles/edit` (with `?id=X`).

- [ ] **Step 1: Create `src/screens/articles/form.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "../../lib/auth-helpers";
import { getArticleById } from "../../lib/admin/articles";
import { listCategories, listTags } from "../../lib/admin/categories";
import { ArticleForm } from "./article-form";
import {
  createArticleAction,
  updateArticleAction,
  publishArticleAction,
  rejectArticleAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ArticleFormScreen({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; error?: string }>;
}) {
  const session = await requireUser();
  const { id: idParam, error } = await searchParams;
  const isAdmin = session.user.role === "admin";

  const [categories, availableTags] = await Promise.all([
    listCategories(),
    listTags(),
  ]);

  if (idParam) {
    const article = await getArticleById(Number(idParam));
    if (!article) redirect("/admin/articles");
    if (!isAdmin && article.authorId !== Number(session.user.id)) {
      redirect("/admin/articles?error=Tidak+diizinkan");
    }

    return (
      <ArticleForm
        mode="edit"
        role={session.user.role ?? "editor"}
        categories={categories}
        availableTags={availableTags}
        error={error}
        initial={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          content: article.content,
          coverImageUrl: article.coverImageUrl,
          categoryId: article.categoryId,
          tagIds: article.tags.map((t) => t.id),
          status: article.status,
        }}
        createAction={createArticleAction}
        updateAction={updateArticleAction}
        publishAction={publishArticleAction}
        rejectAction={rejectArticleAction}
      />
    );
  }

  return (
    <ArticleForm
      mode="create"
      role={session.user.role ?? "editor"}
      categories={categories}
      availableTags={availableTags}
      error={error}
      createAction={createArticleAction}
      updateAction={updateArticleAction}
      publishAction={publishArticleAction}
      rejectAction={rejectArticleAction}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/articles/form.tsx
git commit -m "feat: add ArticleFormScreen server wrapper"
```

---

## Task 9: CategoriesScreen

**Files:**
- Create: `src/screens/categories/page.tsx`

- [ ] **Step 1: Create `src/screens/categories/page.tsx`**

```tsx
import { requireAdmin } from "../../lib/auth-helpers";
import { listCategories, listTags } from "../../lib/admin/categories";
import { ConfirmDelete } from "../../components/confirm-delete";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  createCategoryAction,
  deleteCategoryAction,
  createTagAction,
  deleteTagAction,
} from "./actions";
import { Tag, FolderOpen, AlertCircle, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CategoriesScreen({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const [categories, tags] = await Promise.all([listCategories(), listTags()]);
  const { error } = await searchParams;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-900">Kategori & Tag</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola kategori dan tag artikel.
        </p>
      </div>

      {error && (
        <p
          className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Categories */}
      <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-900">
          <FolderOpen className="h-4 w-4 text-brand-600" />
          Kategori ({categories.length})
        </h2>
        <form action={createCategoryAction} className="mb-4 flex gap-2">
          <Input name="name" placeholder="Nama kategori" required className="flex-1" />
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </form>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada kategori.</p>
        ) : (
          <ul className="divide-y divide-navy-50">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm font-medium text-navy-900">{c.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.slug}</span>
                </div>
                <ConfirmDelete
                  action={deleteCategoryAction}
                  id={c.id}
                  title="Hapus kategori?"
                  description={
                    <>
                      Kategori{" "}
                      <span className="font-medium text-navy-900">{c.name}</span>{" "}
                      akan dihapus. Artikel yang menggunakannya tidak ikut terhapus.
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tags */}
      <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Tag className="h-4 w-4 text-brand-600" />
          Tag ({tags.length})
        </h2>
        <form action={createTagAction} className="mb-4 flex gap-2">
          <Input name="name" placeholder="Nama tag" required className="flex-1" />
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </form>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada tag.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-1 rounded-full bg-navy-50 py-1 pl-3 pr-1 text-xs font-medium text-navy-700 ring-1 ring-navy-100"
              >
                {tag.name}
                <ConfirmDelete
                  action={deleteTagAction}
                  id={tag.id}
                  title="Hapus tag?"
                  description={
                    <>
                      Tag <span className="font-medium text-navy-900">{tag.name}</span> akan dihapus.
                    </>
                  }
                  trigger={
                    <button
                      type="button"
                      aria-label={`Hapus tag ${tag.name}`}
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-navy-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      ×
                    </button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/categories/page.tsx
git commit -m "feat: add CategoriesScreen"
```

---

## Task 10: Update Package Exports + Bump Version

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add 7 new export paths to the `"exports"` object in `package.json`**

After the existing `"./shell/actions"` entry, add:

```json
"./screens/articles": {
  "types": "./dist/screens/articles/page.d.ts",
  "default": "./dist/screens/articles/page.js"
},
"./screens/articles/form": {
  "types": "./dist/screens/articles/form.d.ts",
  "default": "./dist/screens/articles/form.js"
},
"./screens/articles/actions": {
  "types": "./dist/screens/articles/actions.d.ts",
  "default": "./dist/screens/articles/actions.js"
},
"./screens/categories": {
  "types": "./dist/screens/categories/page.d.ts",
  "default": "./dist/screens/categories/page.js"
},
"./screens/categories/actions": {
  "types": "./dist/screens/categories/actions.d.ts",
  "default": "./dist/screens/categories/actions.js"
},
"./admin/articles": {
  "types": "./dist/lib/admin/articles.d.ts",
  "default": "./dist/lib/admin/articles.js"
},
"./admin/categories": {
  "types": "./dist/lib/admin/categories.d.ts",
  "default": "./dist/lib/admin/categories.js"
}
```

- [ ] **Step 2: Bump version from `"0.2.1"` to `"0.3.0"` in `package.json`**

- [ ] **Step 3: Typecheck and build**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: add articles/categories export paths, bump to 0.3.0"
```

---

## Consumer Mounting Convention

The consumer app must mount screens at these exact paths for actions' redirects to work:

```
app/(admin)/admin/articles/page.tsx          → ArticlesScreen
app/(admin)/admin/articles/new/page.tsx      → ArticleFormScreen (no id)
app/(admin)/admin/articles/edit/page.tsx     → ArticleFormScreen (with ?id=X)
app/(admin)/admin/categories/page.tsx        → CategoriesScreen
```

Add nav items to `AdminLayout`:
```ts
{ label: "Artikel", href: "/admin/articles", icon: "FileText" },
{ label: "Kategori & Tag", href: "/admin/categories", icon: "Tag" },
```
