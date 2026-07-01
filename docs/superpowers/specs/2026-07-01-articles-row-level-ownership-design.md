# Row-level ownership for articles

Status: approved
Date: 2026-07-01

## Problem

Row-level ownership already exists for articles, but ad hoc and inconsistent:

- `updateArticle()` (`src/lib/admin/articles.ts`) enforces `authorId === userId` unless
  `ctx.isAdmin`. `ctx.isAdmin` is computed at every call site as
  `can(role, "articles.publish")` — a permission about *publishing*, reused as a proxy
  for "manage everyone's articles."
- `submitForReview()` enforces ownership with **no** override at all — not even a
  `manageAny`-equivalent role can submit on behalf of another author.
- `deleteArticle()` has **no** ownership check. It's gated only by the `articles.delete`
  permission at the action layer. Any role granted `articles.delete` (even one intended
  to be scoped to "own articles") can delete any article.
- `screens/articles/page.tsx` and `screens/articles/form.tsx` each independently compute
  `isAdmin = can(role, "articles.publish")` to decide list-filtering, edit-page access, and
  delete-button visibility. Because this reuses the publish permission, a `viewer` role
  (read-only, no publish) is filtered to "own articles" in the list — but a viewer never
  authors anything, so it sees zero articles. Latent bug caused by the same proxy.
- The delete button in `page.tsx` is shown based on `isAdmin` (publish proxy) rather than
  the actual `articles.delete` permission, so an editor role with `articles.delete` but
  without `articles.publish` never sees a delete button at all.

## Scope

Articles only. Media, users, and categories have no ownership column and are out of
scope for this change.

## Design

### New permission: `articles.manageAny`

Add `articles.manageAny` to `BuiltInPermission` in `src/rbac/permissions.ts`. This is the
single, explicit permission meaning "may view/edit/delete/submit any article, not just
your own." It replaces the `articles.publish` proxy used today.

### Preset updates (`src/rbac/presets.ts`)

- `contentEditor` — add `articles.manageAny` (preserves current behavior: this bundle
  already effectively acts on all articles via the publish proxy).
- `adminEditor.admin` — unaffected; already covered by `"*"`.
- `viewer` (in `fourTier`) — add `articles.manageAny`. This fixes the latent bug: a
  read-only viewer should see all articles, not be scoped to "own" (which is always
  empty for a role that never authors content). Safe because `viewer` has no write
  permissions, so `manageAny` only affects read-list scope for this role.
- `legacyEditor`, `articleAuthor` — unchanged. They keep ownership-scoped behavior,
  preserving the pre-0.8 zero-change upgrade path documented in `presets.ts`.

### Enforcement changes

**`src/lib/admin/articles.ts`**
- `deleteArticle(id, ctx: { userId: number; isAdmin: boolean })` — add the same
  ownership check as `updateArticle`: throw `"Tidak diizinkan menghapus artikel ini."`
  if `!ctx.isAdmin && existing.authorId !== ctx.userId`.
- `submitForReview(id, userId, ctx?: { isAdmin: boolean })` — allow the existing
  `authorId !== userId` check to be bypassed when `ctx.isAdmin` is true, for consistency
  with `updateArticle`/`deleteArticle`. Default (`ctx` omitted) keeps current strict
  behavior for any direct callers.

**`src/screens/articles/actions.ts`**
- Every action that currently computes an ownership-relevant flag switches from
  `can(role, "articles.publish")` to `can(role, "articles.manageAny")`.
- `updateArticleAction` — pass `isAdmin` from `manageAny` instead of `publish`.
- `deleteArticleAction` — compute `isAdmin` from `manageAny`, pass `{ userId, isAdmin }`
  into `deleteArticle`, and wrap the call in try/catch that redirects with an error
  message (matching the pattern in `updateArticleAction`), since `deleteArticle` can now
  throw.
- Where `submitForReview` is called (create/update actions with `intent === "review"`),
  pass `{ isAdmin: can(role, "articles.manageAny") }`.

**`src/screens/articles/page.tsx`**
- `isAdmin` → `can(session.user.role, "articles.manageAny")`, used for the `authorId`
  list filter (unchanged logic, new source permission).
- Delete button visibility changes from `{isAdmin && <ConfirmDelete .../>}` to
  `{can(session.user.role, "articles.delete") && (isAdmin || item.authorId === Number(session.user.id)) && <ConfirmDelete .../>}`.

**`src/screens/articles/form.tsx`**
- `isAdmin` → `can(session.user.role, "articles.manageAny")`, used for both the
  edit-page ownership redirect and `canPublish` passed to `ArticleForm`.

  Note: `canPublish` semantics stay tied to whether the user can publish — but the
  existing code already conflated "can publish" with "is admin-over-all-articles" via
  the same flag. Since `articles.publish` and `articles.manageAny` are granted together
  in every built-in preset, no behavioral change here; `canPublish` will use
  `can(session.user.role, "articles.publish")` directly (now separated from the
  ownership-bypass flag) so a future consumer could grant one without the other.

### No changes

- `publishArticleAction` / `rejectArticleAction` stay gated by `requirePermission("articles.publish")`
  only — publishing/rejecting is inherently a cross-author action for roles that have it;
  no ownership check needed.
- Audit logging (`logAudit`) — no new events added; out of scope.
- Media, users, categories — untouched.

## Testing

- `test/rbac-presets.test.ts` — assert `articles.manageAny` is present for `contentEditor`
  and `fourTier.viewer`, absent for `articleAuthor`/`legacyEditor`.
- New test coverage for `deleteArticle` ownership: owner can delete own article,
  non-owner without `isAdmin` is rejected, `isAdmin: true` can delete any article.
- New test coverage for `submitForReview` with `ctx.isAdmin` override.

## Out of scope / explicitly not doing

- No generic "own vs any" primitive in `rbac/` core — this stays a articles-specific
  convention (`manageAny` permission name + hand-checked `authorId` comparisons in
  `lib/admin/articles.ts`), matching the existing code style rather than introducing a
  new abstraction for a single resource.
- No changes to media/users/categories ownership (they have no author/owner column).
