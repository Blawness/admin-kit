# Customizable RBAC for `@blawness/admin-kit`

**Date:** 2026-06-29
**Status:** Approved design — pending implementation plan
**Scope:** Replace the hardcoded 2-role (`admin` | `editor`) model with consumer-defined, permission-based RBAC. Config-driven, no database tables (Option A). Clean break with a major version bump (0.7.0).

---

## 1. Goals & Non-Goals

### Goals
- Consumers define their own roles, each mapped to a set of fine-grained permissions.
- Permissions are `resource.action` strings with wildcard support (`*`, `articles.*`).
- A single `defineRbac()` entry point returns a pre-wired bundle of helpers (Approach 1) that close over the config — edge-safe, no global state.
- Ship ready-made presets so consumers can start without writing a full permission map.
- Keep the single `users.role` text column (no schema change to the role storage).

### Non-Goals (YAGNI — noted as possible future work)
- DB-backed roles/permissions tables and a UI to manage them.
- Route → permission map enforced in middleware (per-screen `requirePermission` covers gating).
- Client-side `useCan` hook.
- Per-record / ownership rules (e.g. "edit only your own articles").

---

## 2. Current State (what we are replacing)

| Concern | Current implementation |
|---|---|
| Roles | Hardcoded union `type UserRole = "admin" \| "editor"` (`src/lib/admin/users.ts:39`) |
| Storage | `role text default 'editor'` (`src/db/schema.ts:17`) |
| Server gating | `requireAdmin()` = `role !== "admin"` → redirect (`src/lib/auth-helpers.ts`) |
| Token | `token.role` embedded in JWT; default `"editor"` hardcoded (`src/auth/config.ts`) |
| Sidebar gating | `NavItem.adminOnly?: boolean`, filtered by `role === "admin"` (`src/shell/sidebar.tsx`) |
| Last-admin guard | `countAdmins() <= 1` blocks removing the last admin (`src/lib/admin/users.ts`) |

Three gating layers, all keyed on the literal string `"admin"`.

---

## 3. Permission Model

- **Shape:** `resource.action` strings.
- **Built-in permissions** (package-owned screens):

  | Resource | Actions |
  |---|---|
  | `users` | `read`, `create`, `update`, `delete` |
  | `media` | `read`, `upload`, `delete` |
  | `articles` | `read`, `create`, `update`, `delete`, `publish` |
  | `categories` | `read`, `create`, `update`, `delete` |
  | `profile` | `edit` (self-service) |

- **Type:** `type Permission = BuiltInPermission | (string & {})` — autocomplete for built-ins while still allowing arbitrary consumer strings (e.g. `reports.export`).
- **Wildcards:** `*` (all permissions), `resource.*` (all actions on a resource). Resolved at check time.
- **Matcher:** `matches(granted: string, perm: string): boolean` returns true when `granted === perm`, `granted === "${resource}.*"`, or `granted === "*"`.

---

## 4. `defineRbac()` API (Approach 1)

Consumer authors one file (e.g. `rbac.ts`) and imports the returned bundle wherever needed.

```ts
// rbac.ts (consumer)
import { defineRbac, presets } from "@blawness/admin-kit/rbac";

export const rbac = defineRbac({
  roles: {
    superadmin: ["*"],
    editor: ["articles.*", "media.read", "media.upload"],
    author: ["articles.read", "articles.create"],
  },
  fallbackRole: "editor",               // role for new users / tokens missing a role
  protectedPermission: "users.delete",  // cannot remove the last user holding this
});
```

### Config shape
```ts
type RbacConfig = {
  roles: Record<string, Permission[]>;
  fallbackRole: string;          // must be a key of roles
  protectedPermission: Permission;
};
```

### Returned bundle
| Member | Kind | Purpose |
|---|---|---|
| `rbac.authConfig` | `NextAuthConfig` | Edge-safe; jwt/session callbacks store `role`, default via `fallbackRole` |
| `rbac.requirePermission(perm)` | server | Redirect to `/admin` (or 403) if the session lacks `perm` |
| `rbac.requireUser()` / `rbac.requireUserId()` | server | Unchanged auth presence helpers |
| `rbac.can(session, perm)` | pure | Boolean check; no DB, edge-safe |
| `rbac.permissionsFor(role)` | pure | Expands a role to its permission list |
| `rbac.filterNav(items, role)` | pure | Drops nav items whose `requires` is not satisfied |

Helpers close over the config, so call sites stay clean (`rbac.requirePermission("users.delete")`), and there is no edge/node singleton hazard.

### Presets
```ts
import { presets } from "@blawness/admin-kit/rbac";

defineRbac({
  roles: {
    ...presets.adminEditor,                    // { admin: ["*"], editor: [...] }
    author: presets.permissions.articleAuthor, // a curated permission list
  },
  fallbackRole: "editor",
  protectedPermission: "users.delete",
});
```
- `presets.adminEditor` — replicates the current 2-role behavior; smooth path for migrators.
- `presets.fourTier` — common `admin` / `editor` / `author` / `viewer` tiers.
- `presets.permissions.*` — named permission bundles (e.g. `contentEditor`, `mediaManager`, `articleAuthor`).

---

## 5. Data Flow

```
login → jwt callback: token.role = <role string>   (fallbackRole if absent)
                       ↓
per request → session.user.role → rbac.permissionsFor(role)   [resolve from static config]
                       ↓
            can(session, "articles.delete")  → expand wildcard → allow / deny
```

**Token stores role only, never resolved permissions.** The config is static code, so per-request resolution is cheap and always fresh; embedding permissions in the JWT would make config changes invisible until re-login (stale tokens). `permissionsFor` / `can` / `authConfig` import no node-only modules, so they are safe in the edge middleware bundle.

---

## 6. Gating Migration (three layers)

### 6.1 Server screens / actions
Swap `requireAdmin()` → `rbac.requirePermission(perm)`. `requireUser` stays. Mapping:

| Screen / action | Permission |
|---|---|
| users page / create / update / delete | `users.read` / `users.create` / `users.update` / `users.delete` |
| media page / upload / delete | `media.read` / `media.upload` / `media.delete` |
| articles list / new / edit / delete / publish | `articles.read` / `articles.create` / `articles.update` / `articles.delete` / `articles.publish` |
| categories list / create / update / delete | `categories.read` / `categories.create` / `categories.update` / `categories.delete` |
| profile edit | `profile.edit` |

`requirePermission` redirects to `/admin` (or renders a 403) when the permission is missing.

### 6.2 Sidebar
`NavItem.adminOnly?: boolean` → `NavItem.requires?: Permission`. `AdminLayout` calls `rbac.filterNav(items, role)` before rendering; `src/shell/sidebar.tsx` no longer reads `role === "admin"`.

### 6.3 authConfig callbacks
`src/auth/config.ts` still writes `token.role`, but the hardcoded `"editor"` default becomes `fallbackRole`. The `authorized` callback continues to gate `/admin` on auth presence only; detailed gating is per-screen via `requirePermission`. (A route → permission map is deliberately out of scope.)

### 6.4 Last-protected-user guard
Generalize `countAdmins()` (`src/lib/admin/users.ts`):
- **Now:** block deleting/demoting the last `admin`.
- **New:** before a delete or role change, count users whose role still grants `protectedPermission` (via `permissionsFor`). If the target is the only remaining holder, block the action. "Last admin" becomes "last user who can manage users."

### 6.5 Consumer data migration
The `users.role` column is unchanged. Existing `admin` / `editor` values work as-is if the consumer defines those role names (or uses `presets.adminEditor`). Renaming roles requires the consumer to migrate the column values — documented in the migration guide.

---

## 7. File-Level Changes

### New files
| File | Purpose |
|---|---|
| `src/rbac/define-rbac.ts` | `defineRbac(config)` → bundle (closures over config) |
| `src/rbac/permissions.ts` | built-in `Permission` union, `matches`, `permissionsFor`, `can` |
| `src/rbac/presets.ts` | `presets.adminEditor`, `presets.fourTier`, `presets.permissions.*` |
| `src/rbac/index.ts` | barrel exported as `@blawness/admin-kit/rbac` |
| `src/rbac/*.test.ts` | unit tests |

### Modified files
| File | Change |
|---|---|
| `src/auth/config.ts` | static `authConfig` → produced inside `defineRbac`; `fallbackRole` replaces hardcoded `"editor"` |
| `src/lib/auth-helpers.ts` | remove `requireAdmin`; `requirePermission` lives in the bundle; `requireUser` / `requireUserId` stay |
| `src/lib/admin/users.ts` | `countAdmins` → `countUsersWith(protectedPermission)`; `UserRole` union → `string` |
| `src/shell/sidebar.tsx` | `adminOnly` → `requires?: Permission`; remove `role === "admin"` checks |
| `src/shell/layout.tsx` | call `rbac.filterNav` before passing nav items |
| `src/screens/**` | each page/action swaps `requireAdmin()` → `rbac.requirePermission(<perm>)` |
| `src/types/next-auth.d.ts` | `role: string` (already string — no change) |
| `package.json` | add `./rbac` export; bump to `0.7.0` |

---

## 8. Testing Strategy (Vitest, already configured)

- **Pure unit (no DB) — the bulk, fast:** wildcard `matches` (`*`, `resource.*`, exact, miss), `permissionsFor`, `can(session, perm)`, presets expand to expected permission sets.
- **Guard logic:** `countUsersWith(protectedPermission)` blocks removing the last holder (mock the db layer).
- **Bundle wiring:** `defineRbac({...}).requirePermission` redirects when lacking and passes when granted (mock `auth()`).
- **Edge-safety:** assert `permissions.ts` / `define-rbac.ts` `authConfig` pull in no node-only modules, keeping the middleware bundle edge-clean.

---

## 9. Open Risks
- Consumers who rename roles must migrate the `users.role` column; mitigated by `presets.adminEditor` + migration guide.
- `Permission = BuiltInPermission | (string & {})` weakens type-safety for typos in custom permissions — accepted tradeoff for consumer extensibility.
