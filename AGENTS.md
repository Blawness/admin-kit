# Repository Guidelines

## Project Structure & Module Organization

This repository is a reusable Next.js admin kit package. Source code lives in `src/`; compiled JavaScript and declaration files are emitted to `dist/` by TypeScript. Public entry points are controlled by `package.json` `exports`, so update that map when adding new consumable modules.

- `src/components/`: shared React components, including `ui/` primitives and admin-specific widgets.
- `src/screens/`: reusable admin screens and server actions for login, media, and users.
- `src/shell/`: admin layout, sidebar, and shell actions.
- `src/lib/`: shared helpers, R2 storage code, sanitization, slugs, and admin data functions.
- `src/auth/`, `src/db/`, `src/types/`: NextAuth, Drizzle schema/client, and type augmentation.

## Build, Test, and Development Commands

Use pnpm for dependency management.

- `pnpm build`: compiles `src/` into `dist/` with declarations.
- `pnpm typecheck`: runs TypeScript in `--noEmit` mode.
- `pnpm prepare`: runs the same TypeScript build used when this package is installed from Git.

There is no local dev server for this package. Validate integration in a consuming Next.js app with `transpilePackages: ["@blawness/admin-kit"]`.

## Coding Style & Naming Conventions

Write TypeScript with `strict` enabled and React JSX via `react-jsx`. Follow the existing style: two-space indentation in JSON, no semicolons in most TSX component files, named exports, and relative imports inside `src/`. Use kebab-case filenames such as `auth-helpers.ts` and `confirm-delete.tsx`; use PascalCase for React component functions and camelCase for helpers.

Keep package APIs explicit. When adding a public module, add its export to `package.json` and ensure `pnpm build` emits the matching `.js` and `.d.ts` files.

## Testing Guidelines

No test framework is currently configured. For now, treat `pnpm typecheck` and `pnpm build` as required checks before committing. When adding tests, prefer colocated `*.test.ts` or `*.test.tsx` files under `src/` and add a `pnpm test` script in the same change.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes: `feat:`, `fix:`, and `chore:`. Keep messages short and imperative, for example `fix: enforce auth in media screen`.

Pull requests should include a brief description, linked issue when applicable, verification commands run, and screenshots or screen recordings for UI-facing changes. Note any consumer setup changes, especially new peer dependencies, environment variables, or exported entry points.

## Security & Configuration Tips

Do not commit credentials. Runtime consumers must provide required values such as `DATABASE_URL` and R2-related environment variables. Keep auth, storage, and database changes conservative because this package is reused across admin panels.
