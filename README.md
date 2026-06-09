# @blawness/admin-kit

Reusable CMS core (auth, media, users, editor, admin shell, shared components)
extracted from the LIPAN RI site. Consumed as a private Git dependency.

## Consumer setup
1. `pnpm add github:Blawness/admin-kit#vX.Y.Z`
2. Add to `next.config`: `transpilePackages: ["@blawness/admin-kit"]`
3. Ensure Tailwind scans the package and defines the `navy`/`brand`/`gold` tokens.

## Public cached reads (`@blawness/admin-kit/public`)

Render published articles on your public site with caching wired to the admin
mutations out of the box:

```ts
import {
  getPublishedArticles,
  getPublishedArticleBySlug,
  getPublishedArticleSlugs,
} from "@blawness/admin-kit/public";

// app/berita/page.tsx
const posts = await getPublishedArticles({ limit: 12 });

// app/berita/[slug]/page.tsx
export async function generateStaticParams() {
  return (await getPublishedArticleSlugs()).map((slug) => ({ slug }));
}
const post = await getPublishedArticleBySlug(slug); // null if not found/unpublished
```

These helpers use the Next.js 16 `use cache` directive, so the consumer **must**
enable it:

```ts
// next.config.ts
const nextConfig = { cacheComponents: true };
```

Every read is tagged `ARTICLES_TAG` (`"articles"`); the admin actions call
`revalidateTag("articles")` on every create/update/publish/reject/delete, so the
public pages refresh automatically. This entry point is isolated — importing the
rest of the package does **not** require `cacheComponents`.

## Admin list pagination & search

The articles screen now supports `?q=` (title/slug search) and `?page=`
pagination; the media gallery supports `?page=`. The data helpers
(`listArticles`, `countArticles`, `listMedia`, `countMedia`) accept
`limit`/`offset` so large datasets no longer load every row.

## Phase 1 result
- Directive preservation: CONFIRMED (`"use client"` intact in dist after tsc build).
- Consumed by a Next.js 16.2.7 throwaway app via `transpilePackages` + Git-tag dependency: build PASSED, page rendered (HTTP 200).
- Gotchas: pnpm v10 blocks the git dep's `prepare` script by default (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`) — the consumer must add `@blawness/admin-kit` to `pnpm.onlyBuiltDependencies` in package.json (or pnpm-workspace.yaml) so tsc runs and `dist/` builds. The `noop` server action can be typed `() => Promise<void>` even though `ConfirmDelete`'s `action` prop is `(formData: FormData) => Promise<void>` — Next/TS accepts the narrower no-arg signature.
