# Changelog

All notable changes to `@blawness/admin-kit` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

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

## [0.10.0] - 2026-07-01

### Added
- **`articles.manageAny` permission.** Explicit permission meaning "view/edit/
  delete/submit any article, not just your own," replacing the previous
  `articles.publish` proxy that RBAC screens reused for ownership-bypass
  checks. Granted to `presets.permissions.contentEditor` (and therefore
  `presets.fourTier.editor`); `presets.adminEditor.admin` already covers it
  via `"*"`. `presets.fourTier.viewer`, `legacyEditor`, and `articleAuthor`
  are unchanged.

### Fixed
- **Row-level ownership enforcement on articles is now consistent.**
  `deleteArticle` previously had no ownership check at all — any role granted
  `articles.delete` could delete any article regardless of author. It now
  throws unless the caller is the author or has `articles.manageAny`.
  `submitForReview` previously had no admin override; it now accepts an
  optional `ctx: { isAdmin }` to allow a `manageAny` caller to submit on
  behalf of another author. The articles list's delete button is now gated
  on the actual `articles.delete` permission plus ownership/`manageAny`,
  instead of the unrelated `articles.publish` permission.

## [0.9.0] - 2026-06-29

### Added
- **Pluggable storage providers.** Storage is now backend-agnostic: R2 remains
  the default; set `ADMIN_KIT_STORAGE_PROVIDER=uploadthing` and supply
  `UPLOADTHING_TOKEN` to switch to UploadThing. `uploadthing` is added as an
  optional peer dependency (`^7.7.0`) — install it only when using that
  provider (`pnpm add uploadthing`). The public API (`uploadFile`,
  `uploadImage`, `deleteObjectByUrl`) and all built-in screens are unchanged
  against either backend.

## [0.8.0] - 2026-06-29

Customizable, permission-based RBAC. **This is a breaking change** — the fixed
`admin`/`editor` role model is replaced by consumer-defined roles and
`resource.action` permissions. See [`docs/MIGRATION-0.8.md`](docs/MIGRATION-0.8.md)
for the upgrade path (`presets.adminEditor` reproduces the legacy scopes).

### Added
- **`defineRbac(config)`** (`@blawness/admin-kit/rbac`) returns an edge-safe
  bundle (`authConfig`, `can()`, `filterNav()`, …) and registers the resolved
  config into a package-internal registry that the built-in screens read via
  `getActiveRbac()`.
- **Permissions** are `resource.action` strings with wildcard support (`*`,
  `resource.*`); `hasPermission`/`matches` exported from `@blawness/admin-kit/rbac`.
- **`requirePermission("<perm>")`** guard (`@blawness/admin-kit/auth-helpers`).
- **Presets**: `presets.adminEditor` (legacy-compatible), `presets.fourTier`,
  and composable `presets.permissions.*` bundles.
- **Per-request permission resolution** — the JWT stores only the role, so a
  role's permission map can change without forcing users to re-login.

### Changed (breaking)
- `requireAdmin()` is removed — replace with `requirePermission("<perm>")`.
- Nav items use `requires: "<perm>"` instead of `adminOnly: true`.
- Wire auth via `rbac.authConfig` (from `defineRbac`) / `buildAuthConfig(fallbackRole)`
  instead of the old fixed `authConfig`.
- A missing `users.role` now resolves to the configured `fallbackRole` at request
  time. The column's hardcoded `'editor'` default is dropped (migration `0004`);
  run `pnpm db:migrate` (or `drizzle-kit push`).
- Register the config in the Node runtime via `instrumentation.ts` `register()`
  (reliable on cold-start server actions); the admin-layout side-effect import
  alone is not sufficient.

### Fixed
- CI: pin `packageManager` so `pnpm/action-setup` resolves a version.

## [0.7.2] - 2026-06-26

### Fixed
- `ImageUpload` now forwards `allowedTypes` and `maxBytes` to the server action
  via FormData. Previously the server always fell back to `OK_IMAGE_TYPES`,
  silently rejecting non-image files even when the component was configured to
  accept them.

## [0.7.1] - 2026-06-26

### Fixed
- `CHANGELOG.md` now included in the npm tarball so consumers can read version
  history from the package itself.

## [0.7.0] - 2026-06-26

### Added
- **Flexible file upload.** `ImageUpload` gains optional `accept`, `allowedTypes`,
  and `maxBytes` props (defaults unchanged). Non-image files (PDF, documents,
  etc.) are now supported — `uploadImageAction` auto-detects the MIME type and
  uploads non-images raw via the new `uploadFile()` R2 helper (which accepts
  `skipProcessing: true`), while images continue through the sharp pipeline.
  `uploadImage()` now delegates to `uploadFile()` internally.
- **`requireUserId()` helper** (`@blawness/admin-kit/auth-helpers`) returns the
  authenticated user's ID as a `number` (matching DB `serial` columns), avoiding
  `Number(session.user.id)` boilerplate in every mutation.

## [0.6.0] - 2026-06-26

### Added
- Self-service profile editing screen (`/admin/profile`) for name, email, and
  password changes.
- Media gallery: search by filename (`?q=`) and filter by album
  (`?album=`).
- Rate limiting on login (`loginRateLimit`) with audit logging
  (`logAudit` / `logLoginFailure`).
- Admin dashboard with live stats (user count, media count, recent uploads).
- Local demo consumer app under `examples/` (pnpm workspace).

### Fixed
- Login failure detection hardened against null/undefined `authorized` values.
- Media pagination and search now compose properly with album filtering.

## [0.5.0] - 2026-06-09

### Added
- **SEO & feeds.** Articles gain `excerpt`, `metaTitle`, `metaDescription`, and
  `ogImage` columns (migration `0001`), surfaced in the editor (an excerpt field
  plus a collapsible SEO section) and in the public read layer. New cached
  `getSitemapEntries({ siteUrl, articleBasePath })` and
  `generateRssXml({ siteUrl, title, description, … })` helpers
  (`@blawness/admin-kit/public`) produce a Next.js-compatible sitemap and a
  ready-to-serve RSS 2.0 document, both tagged `ARTICLES_TAG`. Adds an
  `escapeXml` helper.
- **Public cached read layer** — new `@blawness/admin-kit/public` entry point
  exporting `getPublishedArticles({ limit, offset, categorySlug })`,
  `getPublishedArticleBySlug(slug)`, and `getPublishedArticleSlugs()`. Each is
  wrapped in the Next.js 16 `use cache` directive and tagged `ARTICLES_TAG`, so
  the existing admin `revalidateTag("articles")` calls now actually refresh the
  public site. Requires `cacheComponents: true` in the consumer; the directive
  is isolated to this entry point so the rest of the package doesn't force it.
- **Server-side search + pagination** on the articles list (`?q=` over
  title/slug, `?page=`) and pagination on the media gallery (`?page=`). New
  `countArticles` / `countMedia` helpers and `limit`/`offset` params on
  `listArticles` / `listMedia` stop the list screens from loading every row.
- `escapeLike` helper so search input is matched literally (no LIKE-wildcard
  injection).

### Changed
- Admin article actions reference the shared `ARTICLES_TAG` constant instead of a
  hardcoded string.
- **Removed `export const dynamic = "force-dynamic"` from all screens.** They are
  already dynamic (they read the session/`searchParams`), and the directive is
  incompatible with `cacheComponents` — which the new `/public` layer requires.
  Consumers can now enable `cacheComponents: true` and use the admin screens and
  the cached public reads in the same app.

## [0.4.1] - 2026-06-09

### Fixed
- **Last-admin lockout.** Demoting (`setRoleAction`) or deleting
  (`deleteUserAction`) the only remaining `admin` is now rejected with a clear
  error instead of silently locking everyone out of the admin area. The check
  runs inside a transaction (`updateUserRole` / `deleteUser`) so it is race-safe,
  and surfaces a new `LastAdminError` / `isLastAdminError` guard.

## [0.4.0] - 2026-06-09

A large reliability, security, and DX release covering 22 findings.

### Fixed
- `categoryId` can now be cleared (`number | null`) on create/update.
- Duplicate-slug attempts are detected on both create **and** update via the
  shared `isUniqueViolation` helper ("Slug sudah digunakan.").
- `publishArticle` / `rejectArticle` now guard on `pending_review` status.
- `deleteArticle` removes the row first, then cleans up the R2 cover object, so
  a storage failure can't block the delete.
- Login failure detection hardened (null/undefined or any "error" string ⇒
  failure) while preserving the `NEXT_REDIRECT` rethrow.
- Module-load no longer throws: `db`, `r2`, and the R2 bucket/URL are lazily
  initialized so `next build` in a consumer app doesn't crash when env vars are
  absent. `R2_BUCKET` is now required (no hardcoded default).
- Editor: dropped the duplicate Tiptap `link` extension.

### Added
- Smart image format preservation in `uploadImage`: animated GIF ⇒ animated
  WebP, alpha/PNG/WebP ⇒ WebP q80, opaque ⇒ mozjpeg JPEG q80, with EXIF
  orientation respected.
- Exported `AdminSessionUser` type for consumers across the package boundary.
- Media uploads accept an optional `album` field (default `"gallery"`).
- Form input is preserved on validation errors (categories, users, articles) —
  never the password.
- Inline editor URL inputs replace `window.prompt()` for links/images, with
  `aria-label`s on all toolbar buttons.
- Database indexes on `articles` (`status`, `author_id`, `category_id`,
  `created_at`).
- Infra: drizzle-kit migrations (`drizzle/0000_init.sql`), Vitest test suite,
  flat ESLint config, and a GitHub Actions CI pipeline
  (typecheck → lint → test → build).

## [0.3.0] - 2026-06

### Added
- `articles` / `categories` export paths.

## [0.2.1] - 2026-06

### Fixed
- Packaging and export adjustments.

## [0.2.0] - 2026-06

Initial public iteration of the admin-kit core (auth, media, users, editor,
admin shell).

[0.11.0]: https://github.com/Blawness/admin-kit/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/Blawness/admin-kit/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/Blawness/admin-kit/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/Blawness/admin-kit/compare/v0.7.3...v0.8.0
[0.7.2]: https://github.com/Blawness/admin-kit/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/Blawness/admin-kit/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/Blawness/admin-kit/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Blawness/admin-kit/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Blawness/admin-kit/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/Blawness/admin-kit/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Blawness/admin-kit/compare/v0.2.1...v0.4.0
[0.3.0]: https://github.com/Blawness/admin-kit/releases/tag/v0.3.0
[0.2.1]: https://github.com/Blawness/admin-kit/releases/tag/v0.2.1
[0.2.0]: https://github.com/Blawness/admin-kit/releases/tag/v0.2.0
