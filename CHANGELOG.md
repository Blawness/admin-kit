# Changelog

All notable changes to `@blawness/admin-kit` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

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

[0.7.0]: https://github.com/Blawness/admin-kit/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Blawness/admin-kit/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Blawness/admin-kit/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/Blawness/admin-kit/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Blawness/admin-kit/compare/v0.2.1...v0.4.0
[0.3.0]: https://github.com/Blawness/admin-kit/releases/tag/v0.3.0
[0.2.1]: https://github.com/Blawness/admin-kit/releases/tag/v0.2.1
[0.2.0]: https://github.com/Blawness/admin-kit/releases/tag/v0.2.0
