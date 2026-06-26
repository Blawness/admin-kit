# Repository Guidelines

## Project Structure & Module Organization

This repository is a reusable Next.js admin kit package. Source code lives in `src/`; compiled JavaScript and declaration files are emitted to `dist/` by TypeScript. Public entry points are controlled by `package.json` `exports`, so update that map when adding new consumable modules.

- `src/components/`: shared React components, including `ui/` primitives and admin-specific widgets.
- `src/screens/`: reusable admin screens and server actions for login, media, users, articles, categories.
- `src/shell/`: admin layout, sidebar, and shell actions.
- `src/lib/`: shared helpers, R2 storage code, sanitization, slugs, and admin data functions.
- `src/auth/`, `src/db/`, `src/types/`: NextAuth, Drizzle schema/client, and type augmentation.
- `test/`: Vitest unit tests (colocated test files are also acceptable under `src/`).

The workspace includes a demo consumer app under `examples/demo` for integration testing.

## Build, Test, and Development Commands

Use pnpm for dependency management.

| Command | Purpose |
|---------|---------|
| `pnpm typecheck` | TypeScript `--noEmit` check |
| `pnpm lint` | ESLint (flat config in `eslint.config.mjs`) |
| `pnpm test` | Vitest (`test/**/*.test.ts`) |
| `pnpm build` | Compile `src/` → `dist/` with declarations |
| `pnpm prepare` | Same build, runs on `pnpm install` from Git |

**Pre-commit verification order (must pass all):**
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

This matches the CI pipeline (`.github/workflows/ci.yml`).

There is no local dev server for this package. Validate integration in a consuming Next.js app with `transpilePackages: ["@blawness/admin-kit"]` (the `examples/demo` app is suitable).

### Database commands (Neon Postgres)
- `pnpm db:generate` — generate migrations from schema changes
- `pnpm db:migrate` — apply migrations

## Coding Style & Naming Conventions

Write TypeScript with `strict` enabled and React JSX via `react-jsx`. Follow the existing style: two-space indentation in JSON, no semicolons in most TSX component files, named exports, and relative imports inside `src/`. Use kebab-case filenames such as `auth-helpers.ts` and `confirm-delete.tsx`; use PascalCase for React component functions and camelCase for helpers.

Keep package APIs explicit. When adding a public module, add its export to `package.json` and ensure `pnpm build` emits the matching `.js` and `.d.ts` files.

## Pre-Release Checklist

Before bumping the version or tagging a release:

1. All checks pass: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
2. Update `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format with the new version heading, categorized entries, and a comparison link at the bottom.
3. Bump `version` in `package.json` (Semantic Versioning).
4. Verify `package.json` `exports` map covers any new modules.
5. Verify `.npmignore` excludes build artifacts, lockfiles, and config files that shouldn't ship (source files ARE shipped intentionally — see `"files": ["dist", "src"]`).

## Commit Guidelines

Use Conventional Commit prefixes: `feat:`, `fix:`, `chore:`. Keep messages short and imperative.

## Security & Configuration Tips

Do not commit credentials. Runtime consumers must provide required values such as `DATABASE_URL` and R2-related environment variables (`R2_BUCKET`, `R2_PUBLIC_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`). Keep auth, storage, and database changes conservative because this package is reused across admin panels.
