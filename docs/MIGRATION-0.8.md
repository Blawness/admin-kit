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
- `middleware.ts`: `NextAuth(rbac.authConfig)` (replaces importing `@blawness/admin-kit/auth/config`).
- Admin root layout: add a side-effect import pointing at your `rbac.ts` (adjust the relative depth to your file, e.g. `import "../../rbac"`) so the config registers in the node runtime. (The demo's layout sits three levels deep and uses `import "../../../rbac"`.)

## 3. Replace gating in your own code
- `requireAdmin()` → `requirePermission("<perm>")` from `@blawness/admin-kit/auth-helpers`.
- Nav items: `adminOnly: true` → `requires: "<perm>"`.

## 4. Data
The `users.role` column is unchanged. Existing `admin`/`editor` rows keep working
as long as those role names exist in your `defineRbac` config (they do if you use
`presets.adminEditor`). If you rename roles, `UPDATE users SET role = ...` accordingly.
