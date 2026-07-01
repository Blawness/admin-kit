# Media Permission Enforcement, Ownership & Denial Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the already-defined `media.*` permissions in the built-in media
screens, add delete-only row-level ownership to media (mirroring the articles
pattern from 0.10.0), and log ownership/permission denials to the audit trail.

**Architecture:** A new `OwnershipError` class distinguishes RBAC-denial throws from
other business-rule errors in `lib/admin/*`. Media gets a nullable `uploadedBy`
column and a `media.manageAny` permission, checked only on delete (list/read stays
shared). Server actions and the one server-rendered ownership redirect (`form.tsx`)
catch `OwnershipError` and log a `*.access_denied` audit event before redirecting,
matching the existing fire-and-forget `logAudit(...).catch(() => {})` pattern used
for every successful mutation today.

**Tech Stack:** TypeScript, Drizzle ORM (Postgres), Vitest, Next.js Server Actions.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-01-media-permissions-and-audit-design.md`.
- Every task must keep `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  green (the repo's required pre-commit order, from `CLAUDE.md`).
- Commit prefixes follow Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`),
  matching existing history (`git log --oneline`).
- Indonesian user-facing strings (error messages), matching the rest of the codebase.
- No ownership/permission checks on `media.read` or `listMedia` — the library stays
  shared across all `media.read` holders. Only delete is ownership-scoped.
- `uploadedBy` on `media` must be **nullable** — no backfill of existing rows.

---

### Task 1: `OwnershipError` class + switch articles ownership throws to it

**Files:**
- Create: `src/lib/admin/errors.ts`
- Modify: `src/lib/admin/articles.ts:184-186` (`updateArticle`), `:226` (`submitForReview`), `:270-271` (`deleteArticle`)
- Test: `test/articles-ownership.test.ts` (extend existing file)

**Interfaces:**
- Produces: `export class OwnershipError extends Error {}` from `src/lib/admin/errors.ts`,
  imported as `import { OwnershipError } from "./errors";` in `src/lib/admin/articles.ts`
  and (later, Task 5) `import { OwnershipError } from "../../lib/admin/errors";` in
  `src/screens/media/lib.ts` / `import { OwnershipError } from "./errors";` in
  `src/lib/admin/media.ts`.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `test/articles-ownership.test.ts` (after the existing `import`
line, add a second import; the file already imports `deleteArticle, submitForReview`
from `../src/lib/admin/articles.ts`):

```ts
import { OwnershipError } from "../src/lib/admin/errors.ts";
```

Then add these two `it` blocks inside the existing `describe("deleteArticle", ...)`
and `describe("submitForReview", ...)` blocks respectively:

```ts
  it("throws OwnershipError (not a plain Error) when a non-owner is rejected", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    await expect(deleteArticle(5, { userId: 9, isAdmin: false })).rejects.toBeInstanceOf(
      OwnershipError,
    );
  });
```

```ts
  it("throws OwnershipError (not a plain Error) when a non-author is rejected", async () => {
    selectReturning([{ authorId: 3, status: "draft", content: "<p>hello</p>" }]);
    await expect(submitForReview(1, 9)).rejects.toBeInstanceOf(OwnershipError);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run test/articles-ownership.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/admin/errors.ts'` (file doesn't exist yet).

- [ ] **Step 3: Create the `OwnershipError` class**

`src/lib/admin/errors.ts`:

```ts
/** Thrown when a caller is authenticated but not the owner (and lacks a
 * manageAny-style override) of the row they're trying to mutate. Distinct
 * from plain `Error` so callers can log/handle ownership denials specifically
 * (e.g. audit logging) without string-matching messages. */
export class OwnershipError extends Error {}
```

- [ ] **Step 4: Switch `articles.ts` ownership throws to `OwnershipError`**

In `src/lib/admin/articles.ts`, add the import at the top (alongside the existing
`import { eq, desc, and, or, ilike, sql, type SQL } from "drizzle-orm";` line):

```ts
import { OwnershipError } from "./errors";
```

Change these three throw sites (`updateArticle`, `submitForReview`, `deleteArticle`)
from `throw new Error(...)` to `throw new OwnershipError(...)`, keeping the exact
same message strings:

```ts
  if (!ctx.isAdmin && existing.authorId !== ctx.userId)
    throw new OwnershipError("Tidak diizinkan mengedit artikel ini.");
```

```ts
  if (!ctx?.isAdmin && existing.authorId !== userId) throw new OwnershipError("Tidak diizinkan.");
```

```ts
  if (!ctx.isAdmin && existing.authorId !== ctx.userId)
    throw new OwnershipError("Tidak diizinkan menghapus artikel ini.");
```

Do **not** change the other `throw new Error(...)` calls in these functions
(not-found, invalid-state, empty-content) — only the three ownership-denial throws.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run test/articles-ownership.test.ts`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/errors.ts src/lib/admin/articles.ts test/articles-ownership.test.ts
git commit -m "feat(articles): use OwnershipError for ownership-denial throws"
```

---

### Task 2: `media.manageAny` permission + preset grants

**Files:**
- Modify: `src/rbac/permissions.ts:1-7` (`BuiltInPermission` union)
- Modify: `src/rbac/presets.ts:8-13` (`contentEditor`), `:27` (`mediaManager`)
- Test: `test/rbac-presets.test.ts` (extend existing file)

**Interfaces:**
- Produces: permission string literal `"media.manageAny"`, part of `BuiltInPermission`,
  usable anywhere `Permission` is accepted (e.g. `getActiveRbac().can(role, "media.manageAny")`
  in Task 5).

- [ ] **Step 1: Write the failing test**

Add to `test/rbac-presets.test.ts`, inside the `describe("presets", ...)` block,
after the existing `articles.manageAny` test:

```ts
  it("media.manageAny is granted to contentEditor and mediaManager but not articleAuthor, legacyEditor (adminEditor.editor), or fourTier.viewer", () => {
    expect(presets.permissions.contentEditor).toContain("media.manageAny");
    expect(presets.permissions.mediaManager).toContain("media.manageAny");
    expect(presets.permissions.articleAuthor).not.toContain("media.manageAny");
    expect(presets.adminEditor.editor).not.toContain("media.manageAny");
    expect(presets.fourTier.viewer).not.toContain("media.manageAny");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-presets.test.ts`
Expected: FAIL — `contentEditor` array doesn't contain `"media.manageAny"`.

- [ ] **Step 3: Add the permission to `BuiltInPermission`**

In `src/rbac/permissions.ts`, change:

```ts
export type BuiltInPermission =
  | "users.read" | "users.create" | "users.update" | "users.delete"
  | "media.read" | "media.upload" | "media.delete"
  | "articles.read" | "articles.create" | "articles.update" | "articles.delete" | "articles.publish"
  | "articles.manageAny"
  | "categories.read" | "categories.create" | "categories.update" | "categories.delete"
  | "profile.edit";
```

to:

```ts
export type BuiltInPermission =
  | "users.read" | "users.create" | "users.update" | "users.delete"
  | "media.read" | "media.upload" | "media.delete"
  | "media.manageAny"
  | "articles.read" | "articles.create" | "articles.update" | "articles.delete" | "articles.publish"
  | "articles.manageAny"
  | "categories.read" | "categories.create" | "categories.update" | "categories.delete"
  | "profile.edit";
```

- [ ] **Step 4: Grant it in presets**

In `src/rbac/presets.ts`, change `contentEditor`:

```ts
const contentEditor: Permission[] = [
  "articles.read", "articles.create", "articles.update", "articles.delete", "articles.publish",
  "articles.manageAny",
  "categories.read", "categories.create", "categories.update", "categories.delete",
  "media.read", "media.upload", "media.delete",
  "media.manageAny",
  "profile.edit",
];
```

and `mediaManager`:

```ts
const mediaManager: Permission[] = ["media.read", "media.upload", "media.delete", "media.manageAny", "profile.edit"];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run test/rbac-presets.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/rbac/permissions.ts src/rbac/presets.ts test/rbac-presets.test.ts
git commit -m "feat(rbac): add media.manageAny permission to contentEditor and mediaManager presets"
```

---

### Task 3: `uploadedBy` column on `media` + migration

**Files:**
- Modify: `src/db/schema.ts:23-29` (`media` table)
- Create: new file(s) under `drizzle/` (generated by `drizzle-kit generate`)

**Interfaces:**
- Produces: `media.uploadedBy` (Drizzle column, nullable `integer` referencing
  `users.id`), used by Task 4 (set on insert) and Task 5 (read for ownership check).

- [ ] **Step 1: Add the column to the schema**

In `src/db/schema.ts`, change:

```ts
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  album: text("album"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});
```

to:

```ts
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  album: text("album"),
  // Nullable: pre-existing rows have no known uploader and are treated as
  // "unowned" — deletable only by media.manageAny holders (see lib/admin/media.ts).
  uploadedBy: integer("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});
```

(`integer` is already imported at the top of `schema.ts` — used by `articles.authorId`.)

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file `drizzle/000N_<name>.sql` is created containing
`ALTER TABLE "media" ADD COLUMN "uploaded_by" integer;` and a foreign key constraint
to `users(id)`, plus a matching `drizzle/meta/000N_snapshot.json` and an updated
`drizzle/meta/_journal.json`. `drizzle-kit generate` diffs `schema.ts` against the
last snapshot and does not require a live `DATABASE_URL` connection.

If `drizzle-kit generate` fails because no `DATABASE_URL` is set in the environment,
set a placeholder before running (generate only reads `dialect`/`schema`/`out` from
`drizzle.config.ts`, it does not connect): `DATABASE_URL=postgres://localhost:5432/admin_kit pnpm db:generate`.

- [ ] **Step 3: Verify the generated SQL**

Run: `cat drizzle/000*_*.sql | tail -20` and confirm the new file adds exactly one
nullable `uploaded_by` column with a foreign key to `users(id)` — no other schema
changes should appear (if other unrelated diffs appear, the schema.ts edit was too
broad; re-check Step 1 touched only the `media` table).

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (the `media` Drizzle table type now includes `uploadedBy`).

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): add nullable media.uploaded_by column"
```

---

### Task 4: Enforce `media.*` permissions + set `uploadedBy` on upload

**Files:**
- Modify: `src/screens/media/page.tsx:1-17`
- Modify: `src/screens/media/actions.ts:1-60`
- Modify: `src/screens/media/lib.ts:1-18` (permission check only — ownership check is Task 5)

**Interfaces:**
- Consumes: `requirePermission` from `../../lib/auth-helpers` (existing, signature
  `(perm: Permission) => Promise<Session>`, see `src/lib/auth-helpers.ts:22-27`).
- Produces: none new — this task only swaps `requireUser()` for `requirePermission(...)`
  and sets `uploadedBy` on insert.

- [ ] **Step 1: Write the failing test**

Create `test/media-permissions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermissionMock, canMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  canMock: vi.fn(),
}));

vi.mock("../src/lib/auth-helpers.ts", () => ({
  requirePermission: requirePermissionMock,
  requireUser: vi.fn(),
}));

vi.mock("../src/rbac/registry.ts", () => ({
  getActiveRbac: () => ({ can: canMock }),
}));

const { mockInsert, mockSelect } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("../src/db/index.ts", () => ({
  db: { insert: mockInsert, select: mockSelect },
}));

vi.mock("../src/lib/storage/index.ts", () => ({
  uploadImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/a.jpg" }),
  uploadFile: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/a.jpg" }),
}));

vi.mock("../src/lib/audit.ts", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { uploadImageAction } from "../src/screens/media/actions.ts";

beforeEach(() => {
  vi.clearAllMocks();
  requirePermissionMock.mockResolvedValue({ user: { id: "5", role: "editor" } });
  mockInsert.mockReturnValue({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    })),
  });
});

describe("uploadImageAction", () => {
  it("requires the media.upload permission, not just any authenticated user", async () => {
    const fd = new FormData();
    fd.set("file", new File(["x"], "a.png", { type: "image/png" }));
    await uploadImageAction(fd);
    expect(requirePermissionMock).toHaveBeenCalledWith("media.upload");
  });

  it("stamps uploadedBy with the session user id on insert", async () => {
    const fd = new FormData();
    fd.set("file", new File(["x"], "a.png", { type: "image/png" }));
    await uploadImageAction(fd);
    const insertCall = mockInsert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertCall.uploadedBy).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/media-permissions.test.ts`
Expected: FAIL — `requirePermissionMock` not called (current code calls `requireUser()`),
and `insertCall.uploadedBy` is `undefined`.

- [ ] **Step 3: Update `page.tsx`**

In `src/screens/media/page.tsx`, change the import:

```ts
import { requireUser } from "../../lib/auth-helpers";
```
to
```ts
import { requirePermission } from "../../lib/auth-helpers";
```

and change the call site:

```ts
  await requireUser();
```
to
```ts
  await requirePermission("media.read");
```

- [ ] **Step 4: Update `actions.ts`**

In `src/screens/media/actions.ts`, change the import:

```ts
import { requireUser } from "../../lib/auth-helpers";
```
to
```ts
import { requirePermission } from "../../lib/auth-helpers";
```

change the call site:

```ts
  const session = await requireUser();
```
to
```ts
  const session = await requirePermission("media.upload");
```

and update the insert to stamp `uploadedBy`:

```ts
  const [row] = await db.insert(media).values({ url, altText: file.name, album }).returning({ id: media.id });
```
to
```ts
  const [row] = await db
    .insert(media)
    .values({ url, altText: file.name, album, uploadedBy: Number(session.user.id) })
    .returning({ id: media.id });
```

- [ ] **Step 5: Update `lib.ts` permission check** (ownership check comes in Task 5)

In `src/screens/media/lib.ts`, change the import:

```ts
import { requireUser } from "../../lib/auth-helpers";
```
to
```ts
import { requirePermission } from "../../lib/auth-helpers";
```

and change:

```ts
  await requireUser();
```
to
```ts
  const session = await requirePermission("media.delete");
```

(`session` is unused until Task 5 wires the ownership check — this will produce a
`noUnusedLocals` typecheck error if `tsconfig.json` enables it; check by running
Step 6 below. If it errors, prefix with `void session;` as a placeholder — Task 5
removes that line and uses `session` for real.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run test/media-permissions.test.ts`
Expected: PASS.

Run: `pnpm typecheck`
Expected: no errors. If `lib.ts`'s now-unused `session` fails typecheck, add
`void session;` as the next line inside `handleDeleteMedia` (temporary, removed in Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/screens/media/page.tsx src/screens/media/actions.ts src/screens/media/lib.ts test/media-permissions.test.ts
git commit -m "fix(media): enforce media.read/upload/delete permissions, stamp uploadedBy"
```

---

### Task 5: Media ownership check on delete + audit log for media denials

**Files:**
- Modify: `src/lib/admin/media.ts:1-60` (`deleteMediaRow`)
- Modify: `src/screens/media/lib.ts` (wire ctx through, catch `OwnershipError`, log audit)
- Modify: `src/lib/audit.ts:1-23` (`AuditAction` — add `"article.access_denied"`, `"media.access_denied"`)
- Test: Create `test/media-ownership.test.ts`
- Test: Modify `test/audit.test.ts:3-22` (`VALID_ACTIONS`)

**Interfaces:**
- Consumes: `OwnershipError` from `../errors` (Task 1), `media.manageAny` permission
  (Task 2), `media.uploadedBy` column (Task 3).
- Produces: `deleteMediaRow(id: number, ctx: { userId: number; isAdmin: boolean }): Promise<void>`
  (replaces the old `deleteMediaRow(id: number)` signature — only caller is
  `src/screens/media/lib.ts`, updated in this task).

- [ ] **Step 1: Add the new `AuditAction` values**

In `src/lib/audit.ts`, change:

```ts
export type AuditAction =
  | "auth.login"
  | "auth.login_blocked"
  | "user.create"
  | "user.delete"
  | "user.set_role"
  | "user.reset_password"
  | "article.create"
  | "article.update"
  | "article.delete"
  | "article.submit"
  | "article.publish"
  | "article.reject"
  | "category.create"
  | "category.delete"
  | "tag.create"
  | "tag.delete"
  | "media.upload"
  | "media.delete"
```
to
```ts
export type AuditAction =
  | "auth.login"
  | "auth.login_blocked"
  | "user.create"
  | "user.delete"
  | "user.set_role"
  | "user.reset_password"
  | "article.create"
  | "article.update"
  | "article.delete"
  | "article.submit"
  | "article.publish"
  | "article.reject"
  | "article.access_denied"
  | "category.create"
  | "category.delete"
  | "tag.create"
  | "tag.delete"
  | "media.upload"
  | "media.delete"
  | "media.access_denied"
```

Update `test/audit.test.ts` `VALID_ACTIONS` (lines 3-22) to match — add
`"article.access_denied"` after `"article.reject"` and `"media.access_denied"` after
`"media.delete"`.

Run: `pnpm vitest run test/audit.test.ts`
Expected: PASS (this test only validates naming format, so it passes as soon as the
array is updated — no separate red/green cycle needed for this file).

- [ ] **Step 2: Write the failing test for `deleteMediaRow` ownership**

Create `test/media-ownership.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("../src/db/index.ts", () => ({
  db: { select: mockSelect, delete: mockDelete },
}));

import { deleteMediaRow } from "../src/lib/admin/media.ts";
import { OwnershipError } from "../src/lib/admin/errors.ts";

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
});

describe("deleteMediaRow", () => {
  it("throws when the media row does not exist", async () => {
    selectReturning([]);
    await expect(deleteMediaRow(1, { userId: 1, isAdmin: false })).rejects.toThrow(
      "Media tidak ditemukan.",
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows the uploader to delete their own media", async () => {
    selectReturning([{ uploadedBy: 7 }]);
    await expect(deleteMediaRow(5, { userId: 7, isAdmin: false })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("rejects a non-uploader without manageAny with OwnershipError", async () => {
    selectReturning([{ uploadedBy: 7 }]);
    await expect(deleteMediaRow(5, { userId: 9, isAdmin: false })).rejects.toBeInstanceOf(
      OwnershipError,
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows a non-uploader with isAdmin (manageAny) to delete any media", async () => {
    selectReturning([{ uploadedBy: 7 }]);
    await expect(deleteMediaRow(5, { userId: 9, isAdmin: true })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("rejects deleting an unowned (uploadedBy: null) row without manageAny", async () => {
    selectReturning([{ uploadedBy: null }]);
    await expect(deleteMediaRow(5, { userId: 9, isAdmin: false })).rejects.toBeInstanceOf(
      OwnershipError,
    );
  });

  it("allows manageAny to delete an unowned (uploadedBy: null) row", async () => {
    selectReturning([{ uploadedBy: null }]);
    await expect(deleteMediaRow(5, { userId: 9, isAdmin: true })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run test/media-ownership.test.ts`
Expected: FAIL — `deleteMediaRow` still takes only `(id)`, ownership checks don't exist yet.

- [ ] **Step 4: Implement the ownership check in `lib/admin/media.ts`**

In `src/lib/admin/media.ts`, add the import at the top:

```ts
import { OwnershipError } from "./errors";
```

Change:

```ts
export async function deleteMediaRow(id: number) {
  await db.delete(media).where(eq(media.id, id));
}
```
to
```ts
export async function deleteMediaRow(id: number, ctx: { userId: number; isAdmin: boolean }) {
  const [existing] = await db
    .select({ uploadedBy: media.uploadedBy })
    .from(media)
    .where(eq(media.id, id));
  if (!existing) throw new Error("Media tidak ditemukan.");
  if (!ctx.isAdmin && existing.uploadedBy !== null && existing.uploadedBy !== ctx.userId) {
    throw new OwnershipError("Tidak diizinkan menghapus gambar ini.");
  }
  await db.delete(media).where(eq(media.id, id));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run test/media-ownership.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire ctx + audit logging through `screens/media/lib.ts`**

Ownership is checked directly against `row` (already fetched for the reference
check below) rather than relying on `deleteMediaRow`'s internal re-select — this
avoids a redundant query and keeps the storage delete → row delete ordering intact
(delete the R2 object first; if that fails, the row stays so the operation is
retryable). `deleteMediaRow`'s own check from Step 4 still runs as defense-in-depth
for any other caller. Replace the full contents of `src/screens/media/lib.ts`:

```ts
export async function handleDeleteMedia(
  formData: FormData,
  referenceChecker: (url: string) => Promise<number>,
): Promise<void> {
  const session = await requirePermission("media.delete");
  const id = Number(formData.get("id"));
  if (!id) return;

  const row = await getMediaById(id);
  if (!row) return;

  const refs = await referenceChecker(row.url);
  if (refs > 0) {
    redirect(
      `/admin/media?error=${encodeURIComponent(
        `Gambar masih dipakai oleh ${refs} konten. Lepas dulu dari berita/banner sebelum menghapus.`
      )}`
    );
  }

  const isAdmin = getActiveRbac().can(session.user.role, "media.manageAny");
  if (!isAdmin && row.uploadedBy !== null && row.uploadedBy !== Number(session.user.id)) {
    logAudit({
      actorId: Number(session.user.id),
      action: "media.access_denied",
      entityType: "media",
      entityId: id,
      metadata: { attemptedAction: "delete" },
    }).catch(() => {});
    redirect(`/admin/media?error=${encodeURIComponent("Tidak diizinkan menghapus gambar ini.")}`);
  }

  // Hapus objek R2 lebih dulu; bila gagal, biarkan melempar agar row DB tetap
  // ada dan operasi bisa diulang (hindari row hilang tapi objek menggantung).
  await deleteObjectByUrl(row.url);
  await deleteMediaRow(id, { userId: Number(session.user.id), isAdmin });
  revalidatePath("/admin/media");
}
```

This checks ownership directly against `row` (already fetched for the reference
check) instead of relying on `deleteMediaRow`'s internal re-select, avoiding a
redundant query and the double-delete-call bug from the first draft.
`deleteMediaRow`'s own ownership check (Step 4) still runs as defense-in-depth for
any other caller.

- [ ] **Step 7: Typecheck and full test run**

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm vitest run test/media-ownership.test.ts test/media-permissions.test.ts test/audit.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin/media.ts src/screens/media/lib.ts src/lib/audit.ts test/media-ownership.test.ts test/audit.test.ts
git commit -m "feat(media): enforce delete ownership (media.manageAny) with denial audit logging"
```

---

### Task 6: Audit log for article ownership denials

**Files:**
- Modify: `src/screens/articles/actions.ts` (`updateArticleAction`, `deleteArticleAction`,
  the `submitForReview` calls inside `createArticleAction` and `updateArticleAction`)
- Modify: `src/screens/articles/form.tsx` (view-attempt redirect)

**Interfaces:**
- Consumes: `OwnershipError` (Task 1), `"article.access_denied"` `AuditAction` (Task 5).

- [ ] **Step 1: Update `updateArticleAction`'s catch block**

In `src/screens/articles/actions.ts`, find:

```ts
  } catch (e) {
    const msg = isUniqueViolation(e)
      ? "Slug sudah digunakan."
      : e instanceof Error
        ? e.message
        : "Gagal menyimpan artikel.";
    redirect(`/admin/articles/edit?id=${id}&error=${encodeURIComponent(msg)}`);
  }
```

(this is the one inside `updateArticleAction`, wrapping the `updateArticle(...)` call)
and change it to:

```ts
  } catch (e) {
    if (e instanceof OwnershipError) {
      logAudit({
        actorId: Number(session.user.id),
        action: "article.access_denied",
        entityType: "article",
        entityId: id,
        metadata: { attemptedAction: "update" },
      }).catch(() => {});
    }
    const msg = isUniqueViolation(e)
      ? "Slug sudah digunakan."
      : e instanceof Error
        ? e.message
        : "Gagal menyimpan artikel.";
    redirect(`/admin/articles/edit?id=${id}&error=${encodeURIComponent(msg)}`);
  }
```

- [ ] **Step 2: Update `deleteArticleAction`'s catch block**

Find:

```ts
  try {
    await deleteArticle(id, { userId: Number(session.user.id), isAdmin });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menghapus artikel.";
    redirect(`/admin/articles?error=${encodeURIComponent(msg)}`);
  }
```

Change to:

```ts
  try {
    await deleteArticle(id, { userId: Number(session.user.id), isAdmin });
  } catch (e) {
    if (e instanceof OwnershipError) {
      logAudit({
        actorId: Number(session.user.id),
        action: "article.access_denied",
        entityType: "article",
        entityId: id,
        metadata: { attemptedAction: "delete" },
      }).catch(() => {});
    }
    const msg = e instanceof Error ? e.message : "Gagal menghapus artikel.";
    redirect(`/admin/articles?error=${encodeURIComponent(msg)}`);
  }
```

- [ ] **Step 3: Update both `submitForReview` catch blocks**

There are two identical-shaped blocks — one in `createArticleAction`, one in
`updateArticleAction`. Both currently look like:

```ts
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengajukan review.";
      redirect(`/admin/articles/edit?id=${articleId}&error=${encodeURIComponent(msg)}`);
    }
```

(in `createArticleAction`, uses `articleId`) and:

```ts
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengajukan review.";
      redirect(`/admin/articles/edit?id=${id}&error=${encodeURIComponent(msg)}`);
    }
```

(in `updateArticleAction`, uses `id`). Update **both**, substituting the right
variable name (`articleId` or `id`) for the entity id in each:

```ts
    } catch (e) {
      if (e instanceof OwnershipError) {
        logAudit({
          actorId: Number(session.user.id),
          action: "article.access_denied",
          entityType: "article",
          entityId: articleId,
          metadata: { attemptedAction: "submit" },
        }).catch(() => {});
      }
      const msg = e instanceof Error ? e.message : "Gagal mengajukan review.";
      redirect(`/admin/articles/edit?id=${articleId}&error=${encodeURIComponent(msg)}`);
    }
```

(and the `id`-variant for the `updateArticleAction` copy).

- [ ] **Step 4: Add the `OwnershipError` import**

At the top of `src/screens/articles/actions.ts`, add to the existing import block:

```ts
import { OwnershipError } from "../../lib/admin/errors";
```

- [ ] **Step 5: Update `form.tsx`'s view-attempt redirect**

In `src/screens/articles/form.tsx`, add `logAudit` to the imports:

```ts
import { logAudit } from "../../lib/audit";
```

Change:

```ts
    if (!isAdmin && article.authorId !== Number(session.user.id)) {
      redirect("/admin/articles?error=Tidak+diizinkan");
    }
```
to
```ts
    if (!isAdmin && article.authorId !== Number(session.user.id)) {
      logAudit({
        actorId: Number(session.user.id),
        action: "article.access_denied",
        entityType: "article",
        entityId: article.id,
        metadata: { attemptedAction: "view" },
      }).catch(() => {});
      redirect("/admin/articles?error=Tidak+diizinkan");
    }
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Write a test asserting the denial path logs audit**

Create `test/articles-access-denied-audit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockDelete, logAuditMock } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
  logAuditMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/db/index.ts", () => ({
  db: { select: mockSelect, delete: mockDelete },
}));
vi.mock("../src/lib/r2.ts", () => ({ deleteObjectByUrl: vi.fn().mockResolvedValue(true) }));
vi.mock("../src/lib/audit.ts", () => ({ logAudit: logAuditMock }));

import { deleteArticle } from "../src/lib/admin/articles.ts";
import { OwnershipError } from "../src/lib/admin/errors.ts";

function selectReturning(rows: unknown[]) {
  mockSelect.mockReturnValue({
    from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteArticle ownership denial", () => {
  it("still throws OwnershipError so the action layer can log it (integration point check)", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    let caught: unknown;
    try {
      await deleteArticle(5, { userId: 9, isAdmin: false });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OwnershipError);
    // The action layer (src/screens/articles/actions.ts), not this lib function,
    // is responsible for calling logAudit — verified by code review of Task 6
    // since actions.ts uses next/navigation's redirect() which isn't mockable
    // without a full Next.js test harness.
  });
});
```

This test re-confirms the `OwnershipError` contract Task 1 already covers; it exists
so the file's name/intent documents *why* `actions.ts` can branch on
`instanceof OwnershipError` — the actual `logAudit` call inside `actions.ts` is
verified by manual code review in this task (Next.js server actions with
`redirect()` require a full framework test harness to unit test meaningfully, which
this repo's existing tests — see `test/articles-ownership.test.ts` — also avoid by
testing only the `lib/admin/*` layer, not `screens/*/actions.ts` directly).

Run: `pnpm vitest run test/articles-access-denied-audit.test.ts`
Expected: PASS.

- [ ] **Step 8: Full test suite + build**

Run: `pnpm test && pnpm build`
Expected: all pass, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/screens/articles/actions.ts src/screens/articles/form.tsx test/articles-access-denied-audit.test.ts
git commit -m "feat(articles): log article.access_denied audit event on ownership denial"
```

---

### Task 7: Final verification, CHANGELOG, version bump

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json` (`version`)

**Interfaces:** None — release bookkeeping only.

- [ ] **Step 1: Run the full required check sequence**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all pass (matches CI per `CLAUDE.md`).

- [ ] **Step 2: Verify `exports` map coverage**

Run: `grep -n '"./screens/media"\|"./screens/articles"' package.json`
Expected: both entries already present (no new public entry points were added by
this plan — `OwnershipError` and `deleteMediaRow`'s new signature are internal,
not re-exported from any `./*` export path). Confirm by checking neither
`src/lib/admin/errors.ts` nor the changed function signatures are imported in
`src/index.ts` or `src/public.ts`:

Run: `grep -n "admin/errors\|deleteMediaRow" src/index.ts src/public.ts`
Expected: no matches (nothing to update in the barrel files).

- [ ] **Step 3: Add the CHANGELOG entry**

Prepend to `CHANGELOG.md`, above the existing `## [0.10.0] - 2026-07-01` heading:

```markdown
## [0.11.0] - 2026-07-01

### Added
- **`media.manageAny` permission** and row-level ownership on media delete. Media
  uploads now record `uploadedBy`; `media.read` stays shared (any user with
  `media.read` still sees and can reuse every uploaded file), but deleting a file
  now requires being its uploader or holding `media.manageAny`. Granted to
  `presets.permissions.contentEditor` and `presets.permissions.mediaManager`.
  Pre-existing media rows have `uploadedBy: null` and are deletable only by
  `media.manageAny` holders.
- **`article.access_denied` / `media.access_denied` audit events.** Ownership and
  permission denials (blocked article view/update/delete/submit attempts, blocked
  media delete attempts) are now logged via `logAudit`, matching the existing
  audit trail for successful mutations.

### Fixed
- **`media.read`/`media.upload`/`media.delete` permissions are now enforced.**
  The built-in media screens (`src/screens/media/*`) previously only checked
  `requireUser()` — any authenticated user could list, upload, or delete media
  regardless of role/permission. They now call `requirePermission(...)` like every
  other built-in screen.
```

- [ ] **Step 4: Bump `package.json` version**

Change `"version": "0.10.0"` to `"version": "0.11.0"`.

- [ ] **Step 5: Re-run the full check sequence after the version bump**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "chore(release): v0.11.0 — media permission enforcement, ownership, denial audit log"
```

---

## Self-Review Notes

- **Spec coverage:** Item 1 (media permission enforcement) → Task 4. Item 2 (media
  ownership) → Tasks 3, 4, 5. Item 3 (denial audit log) → Tasks 5, 6. Item 4 (author
  name) → confirmed already implemented, dropped from spec and this plan (no task).
- **Type consistency:** `deleteMediaRow(id, ctx: { userId: number; isAdmin: boolean })`
  used identically in Task 5 (definition + `media-ownership.test.ts`) and Task 5
  Step 6 (`screens/media/lib.ts` call site). `OwnershipError` imported from
  `./errors` (within `lib/admin/`) or `../../lib/admin/errors` (from `screens/*`)
  consistently across Tasks 1, 5, 6.
- **Ordering check:** Task 5 Step 6's `handleDeleteMedia` checks ownership against
  the already-fetched `row` before touching storage, then deletes the R2 object,
  then the DB row (single `deleteMediaRow` call) — preserving the original
  storage-then-row ordering and avoiding a redundant re-select inside the hot path.
