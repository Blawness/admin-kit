# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@blawness/admin-kit` is a reusable CMS core (auth, RBAC, media, users, articles/categories, Tiptap
editor, admin shell) extracted from the LIPAN RI site, published as a library and consumed by other
Next.js 16 apps as a Git dependency. There is **no app to run** in this repo — it's `src/` compiled to
`dist/` via `tsc`, exported through the `exports` map in `package.json`. Integration is validated by
consuming the package from the `examples/demo` app.

## Commands

```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

This is the required pre-commit/pre-release order and matches CI (`.github/workflows/ci.yml`) exactly.

- `pnpm typecheck` — `tsc -p tsconfig.json --noEmit`
- `pnpm lint` — ESLint flat config (`eslint.config.mjs`)
- `pnpm test` — Vitest, runs `test/**/*.test.ts` (config: `vitest.config.ts`)
  - Single test file: `pnpm vitest run test/storage-uploadthing.test.ts`
  - Single test by name: `pnpm vitest run -t "test name"`
- `pnpm build` — compiles `src/` → `dist/` with declarations; also runs on `pnpm install` from Git via `prepare`
- `pnpm db:generate` / `pnpm db:migrate` — Drizzle Kit against Neon Postgres (`drizzle.config.ts`, migrations in `drizzle/`)

There is no dev server. To validate a change end-to-end, wire it into a consuming Next.js app
(`transpilePackages: ["@blawness/admin-kit"]`) — `examples/demo` is set up for this.

## Architecture

### Public API surface is the `exports` map, not the file tree

`package.json` `exports` defines every consumable entry point (`.`, `./auth`, `./rbac`, `./db`,
`./screens/articles`, `./admin/media`, etc.), each mapped to a compiled `dist/*.js` + `.d.ts` pair.
When adding or moving a public module, **update `exports` and `AGENTS.md`'s module map together** —
`pnpm build` must emit the matching `dist` files or the consumer import breaks. `src/index.ts` and
`src/public.ts` are the two broadest barrel entry points; keep additions to them deliberate since
everything they re-export becomes part of the top-level `.` and `./public` imports.

### RBAC is consumer-defined, not hardcoded

Permissions and roles are not baked into the package. A consuming app calls `defineRbac({ roles,
fallbackRole, protectedPermission })` (see `src/rbac/define-rbac.ts`) once, which:
1. Builds a runtime (`src/rbac/registry.ts`) and registers it as the process-wide active RBAC via
   `setActiveRbac`.
2. Returns an `RbacBundle` with `can`, `filterNav`, `authConfig`, and permission-gated guards.

The built-in screens (articles, media, users, ...) call `requirePermission()` /
`getActiveRbac()` internally — they don't know the consumer's roles, only which `Permission` string
each action needs. `requireUser`/`requireUserId`/`requirePermission` in the returned bundle are
**dynamically imported** from `src/lib/auth-helpers.ts` specifically to keep `define-rbac.ts` itself
edge-safe (importable from Next.js middleware), while the actual guards run Node-only code
(`next/navigation` redirects, DB lookups).

### Storage is a pluggable provider behind one interface

`src/lib/storage/types.ts` defines `StorageProvider` (`put`, `deleteByUrl`). Two implementations exist:
R2 (`src/lib/storage/r2.ts`, default) and UploadThing (`src/lib/storage/uploadthing.ts`, optional peer
dep, dynamically imported only when selected). `src/lib/storage/index.ts` resolves the active provider
once from `ADMIN_KIT_STORAGE_PROVIDER` (lazy + cached in `_provider`; reset via
`_resetProviderForTests` in tests) and exposes provider-agnostic `uploadFile`/`uploadImage`/
`deleteObjectByUrl` used by every screen/action. Adding a new storage backend means implementing
`StorageProvider` and adding a branch in `getActiveProvider`, not touching call sites.

### Cache tags decouple admin mutations from public cached reads

`src/lib/public/*` (exported via `./public`, uses Next.js 16 `use cache`) serves published content
to the consumer's public site, tagged with constants from `src/lib/cache-tags.ts` (e.g.
`ARTICLES_TAG`). Admin server actions in `src/screens/*/actions.ts` call `revalidateTag(ARTICLES_TAG)`
on create/update/publish/delete so public reads invalidate automatically. `cache-tags.ts` is
deliberately a plain module with no `use cache` directive so that importing admin code never forces
`cacheComponents` on consumers who don't use `/public` — only `src/public.ts` and its dependents
require that Next.js config flag. Preserve this isolation when touching either side.

### Module layout (`src/`)

- `auth/` — NextAuth config/instance; `auth/config.ts` is the edge-safe piece `define-rbac.ts` imports.
- `rbac/` — `define-rbac.ts` (consumer entry), `permissions.ts`, `presets.ts`, `registry.ts` (active
  runtime singleton), `nav.ts` (permission-filtered sidebar).
- `db/` — Drizzle schema (`schema.ts`) and client (`index.ts`); `role` on `users` has no hardcoded
  default — it resolves to the consumer's `fallbackRole` at request time.
- `lib/` — cross-cutting helpers: storage (above), `auth-helpers.ts` (Node-only guards), `sanitize.ts`
  (HTML sanitization for Tiptap content), `slug.ts`, `audit.ts`, `rate-limit.ts`, `db-errors.ts`,
  `sql-utils.ts`, `lib/admin/*` (data-access functions per resource), `lib/public/*` (cached reads).
- `screens/` — one directory per admin resource (articles, categories, media, users, login, profile,
  dashboard), each with `page.tsx` + `actions.ts` (server actions) and resource-specific components.
- `shell/` — admin layout, sidebar, shell-level server actions.
- `components/` — shared UI (`ui/` primitives) and admin-specific widgets (editor, image upload).
- `types/next-auth.d.ts` — ambient module augmentation for `session.user` (build-time only; doesn't
  cross the package boundary, hence the explicit `AdminSessionUser` type exported from `index.ts`).

## Conventions (from AGENTS.md)

- Two-space indentation in JSON; no semicolons in most TSX component files; named exports; relative
  imports inside `src/`.
- Filenames: kebab-case (`auth-helpers.ts`, `confirm-delete.tsx`). Components: PascalCase functions.
  Helpers: camelCase.
- Commit prefixes: Conventional Commits (`feat:`, `fix:`, `chore:`), short and imperative.
- Required consumer env vars: `DATABASE_URL`; R2 mode: `R2_BUCKET`, `R2_PUBLIC_URL`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`; UploadThing mode:
  `ADMIN_KIT_STORAGE_PROVIDER=uploadthing`, `UPLOADTHING_TOKEN`.

## Pre-release checklist

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
2. Update `CHANGELOG.md` (Keep a Changelog format) with a new version heading and comparison link.
3. Bump `version` in `package.json` (SemVer).
4. Verify `package.json` `exports` covers any new modules.
5. Verify `.npmignore` excludes build artifacts/lockfiles/config but keeps `dist` and `src` shippable
   (see `"files": ["dist", "src", "CHANGELOG.md"]`).
