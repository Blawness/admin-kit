# Articles Row-Level Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `articles.publish`-as-ownership-bypass proxy with an explicit `articles.manageAny` permission, and make ownership enforcement (update/delete/submit) consistent across the articles feature.

**Architecture:** Add one new permission string (`articles.manageAny`) to the RBAC permission type and grant it to the `contentEditor` preset. Thread an explicit `{ userId, isAdmin }` (or `{ isAdmin }`) context into every `lib/admin/articles.ts` function that currently checks or should check `authorId`, and switch every call site (`screens/articles/actions.ts`, `page.tsx`, `form.tsx`) from the `articles.publish` proxy to `articles.manageAny`.

**Tech Stack:** TypeScript, Drizzle ORM, Next.js 16 Server Actions, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-articles-row-level-ownership-design.md`
- Scope is articles only — do not touch media, users, or categories.
- Do not add `articles.manageAny` to `fourTier.viewer`, `legacyEditor`, or `articleAuthor` — this would break the existing `fourTier viewer is read-only` assertion in `test/rbac-presets.test.ts` and violate the pre-0.8 zero-change upgrade path for `legacyEditor`.
- Error messages shown to users stay in Indonesian, matching existing strings in `src/lib/admin/articles.ts` and `src/screens/articles/actions.ts`.
- This package has no dev server; `screens/*` (React Server Components) are verified via `pnpm typecheck` + `pnpm build`, not new Vitest suites — this matches the existing repo convention (no test file today covers any `screens/*/actions.ts` or `screens/*/page.tsx`).
- Required verification order before any task is considered done, and mandatory as the final task: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (matches `.github/workflows/ci.yml` and `AGENTS.md`).

---

### Task 1: Add `articles.manageAny` permission and grant it to `contentEditor`

**Files:**
- Modify: `src/rbac/permissions.ts:2-7`
- Modify: `src/rbac/presets.ts:8-13`
- Test: `test/rbac-presets.test.ts`

**Interfaces:**
- Produces: `"articles.manageAny"` as a valid `BuiltInPermission` string, granted in `presets.permissions.contentEditor` (and therefore `presets.fourTier.editor`), absent from `presets.permissions.articleAuthor`, `presets.adminEditor.editor` (legacyEditor), and `presets.fourTier.viewer`.

- [ ] **Step 1: Write the failing test**

Open `test/rbac-presets.test.ts` and add this test inside the existing `describe("presets", ...)` block, after the `"named permission bundles exist"` test:

```ts
  it("articles.manageAny is granted to contentEditor but not articleAuthor, legacyEditor (adminEditor.editor), or fourTier.viewer", () => {
    expect(presets.permissions.contentEditor).toContain("articles.manageAny");
    expect(presets.permissions.articleAuthor).not.toContain("articles.manageAny");
    expect(presets.adminEditor.editor).not.toContain("articles.manageAny");
    expect(presets.fourTier.viewer).not.toContain("articles.manageAny");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-presets.test.ts`
Expected: FAIL — `expect(presets.permissions.contentEditor).toContain("articles.manageAny")` fails because the string isn't granted anywhere yet.

- [ ] **Step 3: Add the permission type**

In `src/rbac/permissions.ts`, update the `BuiltInPermission` union (currently lines 2-7):

```ts
/** All permissions the package's own built-in screens check. */
export type BuiltInPermission =
  | "users.read" | "users.create" | "users.update" | "users.delete"
  | "media.read" | "media.upload" | "media.delete"
  | "articles.read" | "articles.create" | "articles.update" | "articles.delete" | "articles.publish"
  | "articles.manageAny"
  | "categories.read" | "categories.create" | "categories.update" | "categories.delete"
  | "profile.edit";
```

- [ ] **Step 4: Grant it in the `contentEditor` preset**

In `src/rbac/presets.ts`, update the `contentEditor` bundle (currently lines 8-13):

```ts
const contentEditor: Permission[] = [
  "articles.read", "articles.create", "articles.update", "articles.delete", "articles.publish",
  "articles.manageAny",
  "categories.read", "categories.create", "categories.update", "categories.delete",
  "media.read", "media.upload", "media.delete",
  "profile.edit",
];
```

Do not modify `articleAuthor`, `legacyEditor`, `mediaManager`, or `viewer`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run test/rbac-presets.test.ts`
Expected: PASS — all tests in the file green, including the existing `"fourTier viewer is read-only"` assertion (unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/rbac/permissions.ts src/rbac/presets.ts test/rbac-presets.test.ts
git commit -m "feat(rbac): add articles.manageAny permission to contentEditor preset"
```

---

### Task 2: Enforce ownership in `deleteArticle`

**Files:**
- Modify: `src/lib/admin/articles.ts:264-277` (the `deleteArticle` function)
- Create: `test/articles-ownership.test.ts`

**Interfaces:**
- Consumes: nothing new from Task 1 (this task only touches the data layer).
- Produces: `deleteArticle(id: number, ctx: { userId: number; isAdmin: boolean }): Promise<void>` — throws `"Artikel tidak ditemukan."` if the article doesn't exist, throws `"Tidak diizinkan menghapus artikel ini."` if `!ctx.isAdmin` and the caller isn't the author. This new signature (adding a required second parameter) is what Task 4 (`actions.ts`) will call.

- [ ] **Step 1: Write the failing tests**

Create `test/articles-ownership.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockDelete, mockUpdate, deleteObjectByUrlMock } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
  deleteObjectByUrlMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("../src/db/index.ts", () => ({
  db: { select: mockSelect, delete: mockDelete, update: mockUpdate },
}));

vi.mock("../src/lib/r2.ts", () => ({ deleteObjectByUrl: deleteObjectByUrlMock }));

import { deleteArticle } from "../src/lib/admin/articles.ts";

/** Make db.select(...).from(...).where(...) resolve to `rows`. */
function selectReturning(rows: unknown[]) {
  mockSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(rows),
    })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mockUpdate.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) });
  deleteObjectByUrlMock.mockResolvedValue(true);
});

describe("deleteArticle", () => {
  it("throws when the article does not exist", async () => {
    selectReturning([]);
    await expect(deleteArticle(1, { userId: 1, isAdmin: false })).rejects.toThrow(
      "Artikel tidak ditemukan.",
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows the owner to delete their own article", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    await expect(deleteArticle(5, { userId: 7, isAdmin: false })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("rejects a non-owner without manageAny", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    await expect(deleteArticle(5, { userId: 9, isAdmin: false })).rejects.toThrow(
      "Tidak diizinkan menghapus artikel ini.",
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows a non-owner with isAdmin (manageAny) to delete any article", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    await expect(deleteArticle(5, { userId: 9, isAdmin: true })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("deletes the R2 cover image after removing the row", async () => {
    selectReturning([{ coverImageUrl: "https://cdn.example.com/x.jpg", authorId: 7 }]);
    await deleteArticle(5, { userId: 7, isAdmin: false });
    expect(deleteObjectByUrlMock).toHaveBeenCalledWith("https://cdn.example.com/x.jpg");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/articles-ownership.test.ts`
Expected: FAIL — `deleteArticle` currently takes only one argument (`id`), so calling it with a second `ctx` argument is a type error the moment `pnpm vitest` transpiles the file, and the "not found" / ownership tests fail because current `deleteArticle` never throws.

- [ ] **Step 3: Implement ownership enforcement**

In `src/lib/admin/articles.ts`, replace the current `deleteArticle` function (lines 264-277):

```ts
export async function deleteArticle(id: number) {
  const [existing] = await db
    .select({ coverImageUrl: articles.coverImageUrl })
    .from(articles)
    .where(eq(articles.id, id));

  await db.delete(articles).where(eq(articles.id, id));

  // Hapus cover di R2 setelah baris terhapus agar kegagalan storage tidak
  // menghalangi penghapusan record. URL non-R2 diabaikan dengan aman.
  if (existing?.coverImageUrl) {
    await deleteObjectByUrl(existing.coverImageUrl);
  }
}
```

with:

```ts
export async function deleteArticle(id: number, ctx: { userId: number; isAdmin: boolean }) {
  const [existing] = await db
    .select({ coverImageUrl: articles.coverImageUrl, authorId: articles.authorId })
    .from(articles)
    .where(eq(articles.id, id));
  if (!existing) throw new Error("Artikel tidak ditemukan.");
  if (!ctx.isAdmin && existing.authorId !== ctx.userId)
    throw new Error("Tidak diizinkan menghapus artikel ini.");

  await db.delete(articles).where(eq(articles.id, id));

  // Hapus cover di R2 setelah baris terhapus agar kegagalan storage tidak
  // menghalangi penghapusan record. URL non-R2 diabaikan dengan aman.
  if (existing.coverImageUrl) {
    await deleteObjectByUrl(existing.coverImageUrl);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/articles-ownership.test.ts`
Expected: PASS — all 5 tests in the `deleteArticle` describe block green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/articles.ts test/articles-ownership.test.ts
git commit -m "feat(articles): enforce row-level ownership in deleteArticle"
```

---

### Task 3: Allow `manageAny` to override ownership in `submitForReview`

**Files:**
- Modify: `src/lib/admin/articles.ts:216-234` (the `submitForReview` function)
- Modify: `test/articles-ownership.test.ts` (append)

**Interfaces:**
- Consumes: nothing new from Task 2.
- Produces: `submitForReview(id: number, userId: number, ctx?: { isAdmin: boolean }): Promise<void>` — the `ctx` parameter is optional so any existing direct caller that omits it keeps today's strict "author only" behavior; passing `{ isAdmin: true }` bypasses the author check. This new optional third parameter is what Task 4 will pass.

- [ ] **Step 1: Write the failing tests**

Append to `test/articles-ownership.test.ts` (after the `deleteArticle` describe block, still inside the same file so it reuses the mocks and `beforeEach` above):

```ts
import { submitForReview } from "../src/lib/admin/articles.ts";

describe("submitForReview", () => {
  it("allows the author to submit their own draft", async () => {
    selectReturning([{ authorId: 3, status: "draft", content: "<p>hello</p>" }]);
    await expect(submitForReview(1, 3)).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("rejects a non-author with no ctx argument", async () => {
    selectReturning([{ authorId: 3, status: "draft", content: "<p>hello</p>" }]);
    await expect(submitForReview(1, 9)).rejects.toThrow("Tidak diizinkan.");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-author when ctx.isAdmin is false", async () => {
    selectReturning([{ authorId: 3, status: "draft", content: "<p>hello</p>" }]);
    await expect(submitForReview(1, 9, { isAdmin: false })).rejects.toThrow("Tidak diizinkan.");
  });

  it("allows a non-author when ctx.isAdmin is true", async () => {
    selectReturning([{ authorId: 3, status: "draft", content: "<p>hello</p>" }]);
    await expect(submitForReview(1, 9, { isAdmin: true })).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalled();
  });
});
```

Move the `import { deleteArticle } from "../src/lib/admin/articles.ts";` line from Task 2 and the new `import { submitForReview } from "../src/lib/admin/articles.ts";` line into a single combined import at the top of the file:

```ts
import { deleteArticle, submitForReview } from "../src/lib/admin/articles.ts";
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run test/articles-ownership.test.ts`
Expected: FAIL on the two `ctx.isAdmin` tests — `submitForReview` doesn't accept a third argument yet, so `{ isAdmin: true }` has no effect and the non-author call still throws `"Tidak diizinkan."` even when it shouldn't.

- [ ] **Step 3: Implement the override**

In `src/lib/admin/articles.ts`, change the `submitForReview` signature and ownership check (currently lines 216-234):

```ts
export async function submitForReview(id: number, userId: number) {
  const [existing] = await db
    .select({
      authorId: articles.authorId,
      status: articles.status,
      content: articles.content,
    })
    .from(articles)
    .where(eq(articles.id, id));
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
```

to:

```ts
export async function submitForReview(id: number, userId: number, ctx?: { isAdmin: boolean }) {
  const [existing] = await db
    .select({
      authorId: articles.authorId,
      status: articles.status,
      content: articles.content,
    })
    .from(articles)
    .where(eq(articles.id, id));
  if (!existing) throw new Error("Artikel tidak ditemukan.");
  if (!ctx?.isAdmin && existing.authorId !== userId) throw new Error("Tidak diizinkan.");
  if (existing.status === "published") throw new Error("Artikel yang sudah dipublikasi tidak dapat diajukan ulang.");
  const stripped = existing.content?.replace(/<[^>]+>/g, "").trim() ?? "";
  if (!stripped) throw new Error("Konten artikel tidak boleh kosong saat mengajukan review.");
  await db
    .update(articles)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(eq(articles.id, id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/articles-ownership.test.ts`
Expected: PASS — all tests in both `deleteArticle` and `submitForReview` describe blocks green (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/articles.ts test/articles-ownership.test.ts
git commit -m "feat(articles): allow manageAny override in submitForReview"
```

---

### Task 4: Wire `articles.manageAny` into `screens/articles/actions.ts`

**Files:**
- Modify: `src/screens/articles/actions.ts:63-120` (`createArticleAction`)
- Modify: `src/screens/articles/actions.ts:122-183` (`updateArticleAction`)
- Modify: `src/screens/articles/actions.ts:227-241` (`deleteArticleAction`)

**Interfaces:**
- Consumes: `deleteArticle(id, { userId, isAdmin })` from Task 2, `submitForReview(id, userId, ctx?)` from Task 3, `getActiveRbac().can(role, perm)` from `src/rbac/registry.ts` (unchanged signature), `"articles.manageAny"` permission from Task 1.
- Produces: no new exports; this is the last layer before UI (Task 5/6) that needs updating.

- [ ] **Step 1: Update `createArticleAction`'s `submitForReview` call**

In `src/screens/articles/actions.ts`, inside `createArticleAction` (around line 104), change:

```ts
  if (intent === "review") {
    try {
      await submitForReview(articleId, Number(session.user.id));
```

to:

```ts
  if (intent === "review") {
    try {
      await submitForReview(articleId, Number(session.user.id), {
        isAdmin: getActiveRbac().can(session.user.role, "articles.manageAny"),
      });
```

(The rest of the `if` block — the `logAudit` call and `catch` — stays unchanged.)

- [ ] **Step 2: Update `updateArticleAction`**

Replace the full `updateArticleAction` function (currently lines 122-183):

```ts
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
      { userId: Number(session.user.id), isAdmin: getActiveRbac().can(session.user.role, "articles.publish") }
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
```

with:

```ts
export async function updateArticleAction(fd: FormData) {
  const session = await requireUser();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  const intent = fd.get("intent") as "draft" | "review";
  const isAdmin = getActiveRbac().can(session.user.role, "articles.manageAny");

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
      { userId: Number(session.user.id), isAdmin }
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
      await submitForReview(id, Number(session.user.id), { isAdmin });
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
```

- [ ] **Step 3: Update `deleteArticleAction`**

Replace the full `deleteArticleAction` function (currently lines 227-241):

```ts
export async function deleteArticleAction(fd: FormData) {
  const session = await requirePermission("articles.delete");
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
```

with:

```ts
export async function deleteArticleAction(fd: FormData) {
  const session = await requirePermission("articles.delete");
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/articles");
  const isAdmin = getActiveRbac().can(session.user.role, "articles.manageAny");
  try {
    await deleteArticle(id, { userId: Number(session.user.id), isAdmin });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menghapus artikel.";
    redirect(`/admin/articles?error=${encodeURIComponent(msg)}`);
  }
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
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. This confirms `updateArticle`, `deleteArticle`, and `submitForReview` are called with signatures matching Tasks 2 and 3.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all existing tests plus the new `test/rbac-presets.test.ts` and `test/articles-ownership.test.ts` assertions green.

- [ ] **Step 6: Commit**

```bash
git add src/screens/articles/actions.ts
git commit -m "feat(articles): wire articles.manageAny into article server actions"
```

---

### Task 5: Fix list-page ownership source and delete-button gating

**Files:**
- Modify: `src/screens/articles/page.tsx:39, 44, 183-196`

**Interfaces:**
- Consumes: `"articles.manageAny"` and `"articles.delete"` permissions via `getActiveRbac().can(role, perm)`.
- Produces: no new exports.

- [ ] **Step 1: Switch the ownership-scope source and compute `canDelete`**

In `src/screens/articles/page.tsx`, change line 39 from:

```ts
  const isAdmin = getActiveRbac().can(session.user.role, "articles.publish");
```

to:

```ts
  const isAdmin = getActiveRbac().can(session.user.role, "articles.manageAny");
  const canDelete = getActiveRbac().can(session.user.role, "articles.delete");
```

Line 44 (`const authorId = isAdmin ? undefined : Number(session.user.id);`) stays unchanged — it now reads the corrected `isAdmin`.

- [ ] **Step 2: Gate the delete button on the actual permission + ownership**

Change the delete button block (currently lines 183-196):

```tsx
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
```

to:

```tsx
                {canDelete && (isAdmin || item.authorId === Number(session.user.id)) && (
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
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. `item.authorId` is already selected as `number` by `listArticles` in `src/lib/admin/articles.ts`, so the comparison type-checks.

- [ ] **Step 4: Commit**

```bash
git add src/screens/articles/page.tsx
git commit -m "fix(articles): gate list delete button on articles.delete + ownership"
```

---

### Task 6: Separate `manageAny` from `publish` on the edit form screen

**Files:**
- Modify: `src/screens/articles/form.tsx:21, 38, 67`

**Interfaces:**
- Consumes: `"articles.manageAny"` and `"articles.publish"` permissions.
- Produces: no new exports.

- [ ] **Step 1: Split the single `isAdmin` flag into ownership-bypass and publish-capability**

In `src/screens/articles/form.tsx`, change line 21 from:

```ts
  const isAdmin = getActiveRbac().can(session.user.role, "articles.publish");
```

to:

```ts
  const isAdmin = getActiveRbac().can(session.user.role, "articles.manageAny");
  const canPublish = getActiveRbac().can(session.user.role, "articles.publish");
```

The ownership redirect at line 31 (`if (!isAdmin && article.authorId !== Number(session.user.id))`) stays unchanged — it now reads the corrected `isAdmin`.

- [ ] **Step 2: Use `canPublish` for both `<ArticleForm>` renders**

Change line 38 (inside the `if (idParam)` edit-mode branch) from:

```tsx
        canPublish={isAdmin}
```

to:

```tsx
        canPublish={canPublish}
```

Change line 67 (inside the create-mode branch) from:

```tsx
      canPublish={isAdmin}
```

to:

```tsx
      canPublish={canPublish}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/articles/form.tsx
git commit -m "fix(articles): decouple canPublish from the manageAny ownership bypass"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full required check sequence**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all four steps PASS, matching `.github/workflows/ci.yml`.

- [ ] **Step 2: Confirm no unrelated files changed**

Run: `git status`
Expected: clean working tree (everything already committed in Tasks 1-6); `dist/` changes from `pnpm build` are untracked/ignored per `.gitignore` and should not be committed.

- [ ] **Step 3: Review the full diff against the spec**

Run: `git log --oneline -7` and `git diff 09dd6ba..HEAD --stat`
Expected: 6 commits (Tasks 1-6), touching exactly: `src/rbac/permissions.ts`, `src/rbac/presets.ts`, `src/lib/admin/articles.ts`, `src/screens/articles/actions.ts`, `src/screens/articles/page.tsx`, `src/screens/articles/form.tsx`, `test/rbac-presets.test.ts`, `test/articles-ownership.test.ts`.
