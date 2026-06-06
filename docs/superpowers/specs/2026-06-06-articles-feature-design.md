# Articles Feature Design

**Date:** 2026-06-06
**Package:** @blawness/admin-kit
**Scope:** Built-in article management — schema, query layer, screens, actions, permissions

---

## Overview

Add a fully built-in articles feature to admin-kit following the existing layered architecture (schema → query layer → screens → actions). Consumer apps mount the provided screens directly with no custom implementation required.

---

## Data Layer

### New Tables (`src/db/schema.ts`)

**`articles`**
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `title` | text, not null | |
| `slug` | text, not null, unique | |
| `content` | text | HTML from Tiptap |
| `coverImageUrl` | text | R2 URL |
| `status` | text | `'draft'` \| `'pending_review'` \| `'published'` |
| `categoryId` | integer | FK → categories.id, nullable |
| `authorId` | integer, not null | FK → users.id |
| `publishedAt` | timestamp | set when published |
| `createdAt` | timestamp | defaultNow() |
| `updatedAt` | timestamp | updated on every write |

**`categories`**
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text, not null, unique | |
| `slug` | text, not null, unique | |

**`tags`**
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text, not null, unique | |
| `slug` | text, not null, unique | |

**`articleTags`** (join table)
| Column | Type | Notes |
|---|---|---|
| `articleId` | integer | FK → articles.id, cascade delete |
| `tagId` | integer | FK → tags.id, cascade delete |

### Query Layer (`src/lib/admin/articles.ts`)

- `listArticles(filters?: { status?, authorId? })` — join author, category, tags
- `getArticleById(id)` — full detail with relations
- `getArticleBySlug(slug)` — for public read / preview
- `createArticle(data, userId)` — auto-set authorId, status defaults to `draft`
- `updateArticle(id, data, ctx: { userId, isAdmin })` — throws if editor tries to update another user's article
- `submitForReview(id, userId)` — sets status to `pending_review`, validates ownership
- `publishArticle(id)` — sets status to `published`, sets `publishedAt`
- `rejectArticle(id)` — sets status back to `draft`
- `deleteArticle(id)` — hard delete

### Query Layer (`src/lib/admin/categories.ts`)

- `listCategories()` — all categories
- `listTags()` — all tags
- `createCategory(data)` / `deleteCategory(id)`
- `createTag(data)` / `deleteTag(id)`

---

## Screens & UI

### `ArticlesScreen` (`src/screens/articles/page.tsx`)

- Protected by `requireUser()`
- List view with columns: title, author, category, status badge, date
- Filter tabs by status: All / Draft / Pending Review / Published
- Editor sees only own articles; admin sees all (filtered server-side via `authorId`)
- Status badges: draft (gray), pending_review (gold), published (brand/cyan)
- "Tulis Artikel" button → links to form

### `ArticleFormScreen` (`src/screens/articles/form.tsx`)

- Protected by `requireUser()`
- Dual-mode: create (no `id`) and edit (with `id` in searchParams)
- Fields:
  - Title input (text)
  - Slug input (auto-generated from title, editable)
  - Cover image (`ImageUpload` component, uses existing `uploadImageAction`)
  - Category select (populated from `listCategories()`)
  - Tag multi-select (populated from `listTags()`)
  - Content (`Editor` Tiptap component)
- Action buttons conditional on role + status:
  - Editor: "Simpan Draft" / "Ajukan Review"
  - Admin: "Simpan Draft" / "Publish" / "Tolak" (Tolak only on pending_review)

### `CategoriesScreen` (`src/screens/categories/page.tsx`)

- Protected by `requireAdmin()`
- Two sections on one page: Categories and Tags
- Inline create form per section (name input → auto-slugify)
- Delete button per item (with `ConfirmDelete` dialog)

---

## Actions & Permissions

### Article Actions (`src/screens/articles/actions.ts`)

| Action | Guard | Notes |
|---|---|---|
| `createArticleAction` | `requireUser` | Sets `authorId` from session |
| `updateArticleAction` | `requireUser` | Ownership check via query layer |
| `submitForReviewAction` | `requireUser` | Only own articles |
| `publishArticleAction` | `requireAdmin` | Sets `publishedAt` |
| `rejectArticleAction` | `requireAdmin` | Resets status to `draft` |
| `deleteArticleAction` | `requireAdmin` | Hard delete |

### Category/Tag Actions (`src/screens/categories/actions.ts`)

| Action | Guard |
|---|---|
| `createCategoryAction` | `requireAdmin` |
| `deleteCategoryAction` | `requireAdmin` |
| `createTagAction` | `requireAdmin` |
| `deleteTagAction` | `requireAdmin` |

### Validation

All actions validate input with Zod:
- `title`: min 3 characters
- `slug`: URL-safe format (`^[a-z0-9-]+$`)
- `content`: required and non-empty when submitting for review
- `categoryId`: optional integer
- `tags`: array of integer IDs

### Error Handling

Follows existing pattern: redirect with `?error=<message>` on failure, caught by `ToastOnParam` or inline error banner in the screen.

Ownership violation (editor editing another user's article) throws from query layer, caught in action, redirects with `?error=Tidak+diizinkan`.

---

## Export Paths

```
./screens/articles          → ArticlesScreen (list)
./screens/articles/form     → ArticleFormScreen (create/edit)
./screens/articles/actions  → article server actions
./screens/categories        → CategoriesScreen
./screens/categories/actions → category/tag server actions
./admin/articles            → query helpers (listArticles, getArticleBySlug, etc.)
./admin/categories          → listCategories, listTags
```

---

## Permission Matrix

| Action | Editor | Admin |
|---|---|---|
| Create article | ✅ | ✅ |
| Edit own article | ✅ | ✅ |
| Edit others' article | ❌ | ✅ |
| Submit for review | ✅ | ✅ |
| Publish article | ❌ | ✅ |
| Reject article | ❌ | ✅ |
| Delete article | ❌ | ✅ |
| Manage categories & tags | ❌ | ✅ |

---

## Out of Scope

- Scheduled publish (future status)
- SEO metadata fields
- Article versioning / revision history
- Comment moderation
- Multi-language / i18n
- Public-facing frontend rendering
