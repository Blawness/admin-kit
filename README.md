# @blawness/admin-kit

Reusable CMS core (auth, media, users, editor, admin shell, shared components)
extracted from the LIPAN RI site. Consumed as a private Git dependency.

## Consumer setup
1. `pnpm add github:Blawness/admin-kit#vX.Y.Z`
2. Add to `next.config`: `transpilePackages: ["@blawness/admin-kit"]`
3. Ensure Tailwind scans the package and defines the `navy`/`brand`/`gold` tokens.

## Phase 1 result
- Directive preservation: CONFIRMED (`"use client"` intact in dist after tsc build).
- Consumed by a Next.js 16.2.7 throwaway app via `transpilePackages` + Git-tag dependency: build PASSED, page rendered (HTTP 200).
- Gotchas: pnpm v10 blocks the git dep's `prepare` script by default (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`) — the consumer must add `@blawness/admin-kit` to `pnpm.onlyBuiltDependencies` in package.json (or pnpm-workspace.yaml) so tsc runs and `dist/` builds. The `noop` server action can be typed `() => Promise<void>` even though `ConfirmDelete`'s `action` prop is `(formData: FormData) => Promise<void>` — Next/TS accepts the narrower no-arg signature.
