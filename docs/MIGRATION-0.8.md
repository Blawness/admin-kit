# Migrating to admin-kit 0.8 (Customizable RBAC)

0.8 replaces the fixed `admin`/`editor` roles with consumer-defined RBAC.

## 1. Create `rbac.ts`
```ts
import { defineRbac, presets } from "@blawness/admin-kit/rbac";
export const rbac = defineRbac({
  roles: { ...presets.adminEditor },     // keep old admin/editor behavior
  fallbackRole: "editor",
  protectedPermission: "users.delete",
});
```

## 2. Wire it
- `middleware.ts`: `NextAuth(rbac.authConfig)` (replaces importing `@blawness/admin-kit/auth/config`). This runs on the edge runtime and is the required wiring for auth middleware.
- **`instrumentation.ts` (recommended):** Register your config in the node runtime by adding an `instrumentation.ts` at your project root:
  ```ts
  export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./rbac");
    }
  }
  ```
  This guarantees registration on every cold start regardless of which module graph is evaluated first. Without it, a cold serverless instance handling a server-action POST that doesn't evaluate the admin layout module graph will hit `getActiveRbac()` → throw "RBAC not configured" → 500.
- Admin root layout: you may also add a side-effect import pointing at your `rbac.ts` (e.g. `import "../../rbac"`). This is sufficient for page requests but **does not cover server actions on cold starts** — relying on it alone is fragile in serverless environments. The demo's layout uses `import "../../../rbac"` as a belt-and-suspenders addition alongside `instrumentation.ts`.

## 3. Replace gating in your own code
- `requireAdmin()` → `requirePermission("<perm>")` from `@blawness/admin-kit/auth-helpers`.
- Nav items: `adminOnly: true` → `requires: "<perm>"`.

## 4. Data
The `users.role` column is unchanged. Existing `admin`/`editor` rows keep working
as long as those role names exist in your `defineRbac` config (they do if you use
`presets.adminEditor`). If you rename roles, `UPDATE users SET role = ...` accordingly.
