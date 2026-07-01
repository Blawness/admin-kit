# Media permission enforcement, media ownership, denial audit log, author display

Status: approved
Date: 2026-07-01

## Problem

Following the 0.10.0 articles row-level ownership work, the same audit surfaced adjacent gaps:

1. **`media.read`/`media.upload`/`media.delete` are defined but never enforced.**
   `src/rbac/permissions.ts` and `src/rbac/presets.ts` define these permissions, but
   `src/screens/media/page.tsx`, `src/screens/media/actions.ts`, and
   `src/screens/media/lib.ts` only call `requireUser()` — any authenticated user can
   list, upload, and delete media regardless of role/permission. Contrast with
   articles, which correctly call `requirePermission(...)`.
2. **Media has no ownership concept.** Any user (once permission-gated) can delete
   media uploaded by someone else, with no `manageAny`-style override to make that
   an explicit, auditable grant.
3. **Ownership/permission denials are silent.** When `updateArticle`/`deleteArticle`/
   `submitForReview` reject a non-owner, or `form.tsx` redirects a non-owner away from
   an edit page, nothing is logged. `logAudit` exists and is used for successful
   mutations, but not for blocked attempts — no trail for "who tried to touch what
   they don't own."
## Scope

Media (`src/screens/media/*`, `src/lib/admin/media.ts`, `src/db/schema.ts`) and
articles (`src/lib/admin/articles.ts`, `src/screens/articles/*`). Users and categories
remain out of scope — no ownership column, no changes.

## Design

### 1. Enforce media permissions

- `src/screens/media/page.tsx` — `requireUser()` → `requirePermission("media.read")`.
- `src/screens/media/actions.ts` (`uploadImageAction`) — `requireUser()` →
  `requirePermission("media.upload")`.
- `src/screens/media/lib.ts` (`handleDeleteMedia`) — `requireUser()` →
  `requirePermission("media.delete")`.

No preset changes needed — `media.read`/`media.upload`/`media.delete` are already
granted to the roles that should have them (`mediaManager`, `adminEditor.admin` via
`"*"`, etc.); this only makes the checks real.

### 2. Media ownership (delete-only, list stays shared)

Media is a shared library — any user with `media.read` continues to see and pick
**all** media (e.g. to reuse another author's image as a cover). Only deletion is
ownership-scoped.

**Schema** (`src/db/schema.ts`): add nullable `uploadedBy` to `media`:

```ts
uploadedBy: integer("uploaded_by").references(() => users.id),
```

Nullable so existing rows need no backfill — pre-migration media has `uploadedBy: null`,
treated as "unowned," deletable only by `media.manageAny` holders. New Drizzle migration
generated via `pnpm db:generate`.

**New permission**: `media.manageAny` added to `BuiltInPermission` in
`src/rbac/permissions.ts`, meaning "delete any media, not just your own." Add to the
`contentEditor` and `mediaManager` bundles in `src/rbac/presets.ts` (mirrors exactly
where `articles.manageAny` was added — `contentEditor` — plus `mediaManager` since it
already grants `media.delete`). `adminEditor.admin` is covered implicitly via `"*"`.
`legacyEditor` and `articleAuthor` are unchanged (neither grants `media.delete` today,
so an ownership-bypass permission would be meaningless for them) — matching the
zero-change upgrade path rationale already used for `articles.manageAny`.

**Enforcement** (`src/lib/admin/media.ts`):
- `deleteMediaRow(id, ctx: { userId: number; isAdmin: boolean })` — look up the row
  first; if `!ctx.isAdmin && row.uploadedBy !== null && row.uploadedBy !== ctx.userId`,
  throw `OwnershipError("Tidak diizinkan menghapus gambar ini.")`. Rows with
  `uploadedBy === null` are deletable only when `ctx.isAdmin`.

**Upload** (`src/screens/media/actions.ts`): `uploadImageAction` sets
`uploadedBy: Number(session.user.id)` on insert.

**Call site** (`src/screens/media/lib.ts`): `handleDeleteMedia` computes
`isAdmin = getActiveRbac().can(session.user.role, "media.manageAny")` and passes
`{ userId, isAdmin }` through to `deleteMediaRow`.

### 3. Audit log for ownership/permission denials

**`src/lib/admin/errors.ts` (new file)** — shared `OwnershipError` class:

```ts
export class OwnershipError extends Error {}
```

Used in place of plain `Error` for ownership-denial throws in
`src/lib/admin/articles.ts` (`updateArticle`, `submitForReview`, `deleteArticle`) and
`src/lib/admin/media.ts` (`deleteMediaRow`). Other throws in those functions
(not-found, invalid state, empty content) stay plain `Error` — only ownership denials
get the dedicated type, so call sites can distinguish "blocked by RBAC" from "blocked
by business rule" without string-matching messages.

**`src/lib/audit.ts`** — extend `AuditAction` with `"article.access_denied"` and
`"media.access_denied"`.

**Call sites** — in `src/screens/articles/actions.ts` (`updateArticleAction`,
`deleteArticleAction`, and the `submitForReview` calls inside
`createArticleAction`/`updateArticleAction`) and `src/screens/media/lib.ts`
(`handleDeleteMedia`), catch blocks check `instanceof OwnershipError` and call
`logAudit({ actorId, action: "article.access_denied" | "media.access_denied", entityType, entityId, metadata: { attemptedAction: "update"|"delete"|"submit" } }).catch(() => {})`
before the existing redirect. Fire-and-forget, same pattern as every other
`logAudit` call in this codebase.

**`src/screens/articles/form.tsx`** — the view-attempt redirect
(`if (!isAdmin && article.authorId !== Number(session.user.id)) redirect(...)`) also
logs `article.access_denied` with `metadata: { attemptedAction: "view" }` before
redirecting.

### 4. Author name in articles list — already implemented, dropped from scope

Verified during planning: `listArticles` (`src/lib/admin/articles.ts:31-62`) already
left-joins `users` and returns `authorName`, and `src/screens/articles/page.tsx:168`
already renders `{item.authorName} · {item.categoryName} · ...` for every row,
unconditionally. Nothing to build here — removed from this design.

## Testing

- `test/rbac-presets.test.ts` — `media.manageAny` present on `contentEditor` and
  `mediaManager`; absent on `legacyEditor`/`articleAuthor`/`viewer`.
- New coverage for `deleteMediaRow`: owner can delete own upload, non-owner without
  `isAdmin` is rejected (`OwnershipError`), `isAdmin: true` can delete any media,
  `uploadedBy: null` rows only deletable by `isAdmin`.
- New coverage asserting `handleDeleteMedia`/`uploadImageAction`/`page.tsx` now require
  the corresponding `media.*` permission (currently only `requireUser()` — test should
  fail against the old code, pass after the fix).
- New coverage that ownership-denial paths (`updateArticle`, `deleteArticle`,
  `submitForReview`, `deleteMediaRow`) throw `OwnershipError` specifically (not plain
  `Error`), and that the action-layer catch blocks call `logAudit` with the right
  `action`/`metadata` on denial.

## Out of scope / explicitly not doing

- No ownership on `categoryId`/tags/users — no author-like column exists, out of scope.
- Media list/read stays fully shared across all `media.read` holders — no per-user
  filtering, unlike articles' list filtering. This is a deliberate scope difference,
  not an oversight (see Design §2).
- Not adding a UI to browse the audit log for these new denial events — `listAuditLogs`
  already surfaces all `auditLogs` rows generically; no new screen needed.
- Not backfilling `uploadedBy` for existing media rows — left `null` (unowned),
  consistent with how `authorId` was already `NOT NULL` from day one for articles
  (different situation: media predates any ownership concept, articles never did).
