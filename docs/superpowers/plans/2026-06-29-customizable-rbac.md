# Customizable RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `admin|editor` model with consumer-defined, permission-based RBAC driven by a single `defineRbac()` entry point.

**Architecture:** `defineRbac(config)` returns an edge-safe bundle (authConfig + pure helpers) AND registers the resolved config into a package-internal module-level registry. Built-in screens resolve permissions through that registry (`getActiveRbac()`). The JWT stores only the role string; permissions are resolved per-request from static config. Node-only guards (`requirePermission`) live in `auth-helpers`; the edge bundle reaches them via dynamic import.

**Tech Stack:** TypeScript (ESM, `moduleResolution: Bundler`), Next.js 16, NextAuth v5, Drizzle ORM, Vitest.

## Global Constraints

- Package is published; this is a **clean break** → bump `version` `0.7.3` → `0.8.0` in `package.json`.
- `permissionsFor` / `can` / registry / `defineRbac` / `buildAuthConfig` must be **edge-safe**: no static import of `../auth/index`, `../db/index`, `bcryptjs`, or any node-only module. Reach node code via dynamic `import()` only.
- Tests live in `test/**/*.test.ts` (Vitest `include: ["test/**/*.test.ts"]`). Import source with explicit `.ts` extension, e.g. `from "../src/rbac/permissions.ts"`.
- Permission string shape: `resource.action`. Built-ins: `users.{read,create,update,delete}`, `media.{read,upload,delete}`, `articles.{read,create,update,delete,publish}`, `categories.{read,create,update,delete}`, `profile.edit`.
- Wildcards: `*` (all), `resource.*` (all actions of a resource).
- Commit after every task. Run `pnpm test` (full suite) before each commit in implementation tasks.

---

### Task 1: Permission primitives (`permissions.ts`)

**Files:**
- Create: `src/rbac/permissions.ts`
- Test: `test/rbac-permissions.test.ts`

**Interfaces:**
- Produces:
  - `type BuiltInPermission` (string union of all built-ins)
  - `type Permission = BuiltInPermission | (string & {})`
  - `function matches(granted: string, perm: string): boolean`
  - `function hasPermission(granted: readonly string[], perm: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// test/rbac-permissions.test.ts
import { describe, it, expect } from "vitest";
import { matches, hasPermission } from "../src/rbac/permissions.ts";

describe("matches", () => {
  it("matches exact permission", () => {
    expect(matches("articles.delete", "articles.delete")).toBe(true);
  });
  it("matches resource wildcard", () => {
    expect(matches("articles.*", "articles.delete")).toBe(true);
  });
  it("matches global wildcard", () => {
    expect(matches("*", "users.create")).toBe(true);
  });
  it("does not match different resource wildcard", () => {
    expect(matches("media.*", "articles.delete")).toBe(false);
  });
  it("does not match different exact", () => {
    expect(matches("articles.read", "articles.delete")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("is true when any granted entry matches", () => {
    expect(hasPermission(["media.read", "articles.*"], "articles.delete")).toBe(true);
  });
  it("is false when nothing matches", () => {
    expect(hasPermission(["media.read"], "articles.delete")).toBe(false);
  });
  it("is false for empty grants", () => {
    expect(hasPermission([], "articles.delete")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-permissions.test.ts`
Expected: FAIL — cannot find module `../src/rbac/permissions.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/rbac/permissions.ts

/** All permissions the package's own built-in screens check. */
export type BuiltInPermission =
  | "users.read" | "users.create" | "users.update" | "users.delete"
  | "media.read" | "media.upload" | "media.delete"
  | "articles.read" | "articles.create" | "articles.update" | "articles.delete" | "articles.publish"
  | "categories.read" | "categories.create" | "categories.update" | "categories.delete"
  | "profile.edit";

/**
 * A permission string of the form `resource.action`. Built-ins get
 * autocomplete; the `(string & {})` arm keeps arbitrary consumer strings
 * (e.g. "reports.export") assignable without widening to plain `string`.
 */
export type Permission = BuiltInPermission | (string & {});

/** True if a single granted entry covers `perm` (exact, `resource.*`, or `*`). */
export function matches(granted: string, perm: string): boolean {
  if (granted === "*" || granted === perm) return true;
  const dot = perm.indexOf(".");
  if (dot === -1) return false;
  const resource = perm.slice(0, dot);
  return granted === `${resource}.*`;
}

/** True if any of the granted entries covers `perm`. */
export function hasPermission(granted: readonly string[], perm: string): boolean {
  return granted.some((g) => matches(g, perm));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/rbac-permissions.test.ts`
Expected: PASS (11 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/rbac/permissions.ts test/rbac-permissions.test.ts
git commit -m "feat(rbac): permission types + wildcard matcher"
```

---

### Task 2: Config registry (`registry.ts`)

**Files:**
- Create: `src/rbac/registry.ts`
- Test: `test/rbac-registry.test.ts`

**Interfaces:**
- Consumes: `Permission`, `hasPermission` from `./permissions`.
- Produces:
  - `type ResolvedRbacConfig = { roles: Record<string, string[]>; fallbackRole: string; protectedPermission: string }`
  - `type RbacRuntime = { config: ResolvedRbacConfig; permissionsFor(role: string): string[]; can(role: string | null | undefined, perm: Permission): boolean }`
  - `function buildRuntime(config: ResolvedRbacConfig): RbacRuntime`
  - `function setActiveRbac(rt: RbacRuntime): void`
  - `function getActiveRbac(): RbacRuntime` (throws if unset)
  - `function peekActiveRbac(): RbacRuntime | null`

- [ ] **Step 1: Write the failing test**

```ts
// test/rbac-registry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildRuntime, setActiveRbac, getActiveRbac, peekActiveRbac } from "../src/rbac/registry.ts";

const config = {
  roles: { admin: ["*"], editor: ["articles.*", "media.read"], viewer: [] },
  fallbackRole: "editor",
  protectedPermission: "users.delete",
};

describe("buildRuntime", () => {
  it("permissionsFor returns the role's list", () => {
    const rt = buildRuntime(config);
    expect(rt.permissionsFor("editor")).toEqual(["articles.*", "media.read"]);
  });
  it("permissionsFor falls back for unknown role", () => {
    const rt = buildRuntime(config);
    expect(rt.permissionsFor("ghost")).toEqual(["articles.*", "media.read"]);
  });
  it("can resolves wildcard", () => {
    const rt = buildRuntime(config);
    expect(rt.can("editor", "articles.delete")).toBe(true);
    expect(rt.can("editor", "users.create")).toBe(false);
    expect(rt.can("admin", "users.create")).toBe(true);
  });
  it("can uses fallback role for null/undefined", () => {
    const rt = buildRuntime(config);
    expect(rt.can(null, "articles.read")).toBe(true);
    expect(rt.can(undefined, "users.delete")).toBe(false);
  });
});

describe("registry holder", () => {
  beforeEach(() => setActiveRbac(buildRuntime(config)));
  it("getActiveRbac returns the set runtime", () => {
    expect(getActiveRbac().config.fallbackRole).toBe("editor");
  });
  it("peekActiveRbac returns runtime when set", () => {
    expect(peekActiveRbac()).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-registry.test.ts`
Expected: FAIL — cannot find module `../src/rbac/registry.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/rbac/registry.ts
import { hasPermission, type Permission } from "./permissions";

export type ResolvedRbacConfig = {
  roles: Record<string, string[]>;
  fallbackRole: string;
  protectedPermission: string;
};

export type RbacRuntime = {
  config: ResolvedRbacConfig;
  permissionsFor(role: string): string[];
  can(role: string | null | undefined, perm: Permission): boolean;
};

/** Build a pure (edge-safe) runtime from a resolved config. */
export function buildRuntime(config: ResolvedRbacConfig): RbacRuntime {
  const permissionsFor = (role: string): string[] =>
    config.roles[role] ?? config.roles[config.fallbackRole] ?? [];
  const can = (role: string | null | undefined, perm: Permission): boolean =>
    hasPermission(permissionsFor(role ?? config.fallbackRole), perm);
  return { config, permissionsFor, can };
}

// Module-level holder. defineRbac() sets this; built-in screens read it.
let active: RbacRuntime | null = null;

/** Register the active runtime (called by defineRbac in each runtime). */
export function setActiveRbac(rt: RbacRuntime): void {
  active = rt;
}

/** Active runtime or throw a clear setup error. */
export function getActiveRbac(): RbacRuntime {
  if (!active) {
    throw new Error(
      "@blawness/admin-kit: RBAC not configured. Call defineRbac(...) and ensure your rbac module is imported in middleware (edge) and the admin root layout (node).",
    );
  }
  return active;
}

/** Active runtime or null — for callbacks that have a fallback. */
export function peekActiveRbac(): RbacRuntime | null {
  return active;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/rbac-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rbac/registry.ts test/rbac-registry.test.ts
git commit -m "feat(rbac): config registry + runtime resolver"
```

---

### Task 3: Presets (`presets.ts`)

**Files:**
- Create: `src/rbac/presets.ts`
- Test: `test/rbac-presets.test.ts`

**Interfaces:**
- Consumes: `Permission` from `./permissions`.
- Produces: `const presets` with shape:
  - `presets.adminEditor: Record<string, Permission[]>` → `{ admin: ["*"], editor: [...] }`
  - `presets.fourTier: Record<string, Permission[]>` → `{ admin, editor, author, viewer }`
  - `presets.permissions: Record<string, Permission[]>` → named bundles `contentEditor`, `mediaManager`, `articleAuthor`

- [ ] **Step 1: Write the failing test**

```ts
// test/rbac-presets.test.ts
import { describe, it, expect } from "vitest";
import { presets } from "../src/rbac/presets.ts";

describe("presets", () => {
  it("adminEditor gives admin full access", () => {
    expect(presets.adminEditor.admin).toEqual(["*"]);
  });
  it("adminEditor editor cannot manage users", () => {
    expect(presets.adminEditor.editor).not.toContain("users.delete");
    expect(presets.adminEditor.editor.some((p) => p.startsWith("articles"))).toBe(true);
  });
  it("fourTier has four roles", () => {
    expect(Object.keys(presets.fourTier).sort()).toEqual(["admin", "author", "editor", "viewer"]);
  });
  it("fourTier viewer is read-only", () => {
    expect(presets.fourTier.viewer.every((p) => p.endsWith(".read"))).toBe(true);
  });
  it("named permission bundles exist", () => {
    expect(presets.permissions.articleAuthor).toContain("articles.create");
    expect(presets.permissions.mediaManager).toContain("media.delete");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-presets.test.ts`
Expected: FAIL — cannot find module `../src/rbac/presets.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/rbac/presets.ts
import type { Permission } from "./permissions";

const articleAuthor: Permission[] = [
  "articles.read", "articles.create", "articles.update",
  "media.read", "media.upload",
];

const contentEditor: Permission[] = [
  "articles.read", "articles.create", "articles.update", "articles.delete", "articles.publish",
  "categories.read", "categories.create", "categories.update", "categories.delete",
  "media.read", "media.upload", "media.delete",
  "profile.edit",
];

const mediaManager: Permission[] = ["media.read", "media.upload", "media.delete", "profile.edit"];

const viewer: Permission[] = [
  "articles.read", "categories.read", "media.read", "users.read", "profile.edit",
];

/** Ready-made role maps and permission bundles consumers can spread into defineRbac. */
export const presets = {
  /** Replicates the legacy 2-role behavior. */
  adminEditor: {
    admin: ["*"] as Permission[],
    editor: [...contentEditor, "profile.edit"] as Permission[],
  },
  /** Common four-tier hierarchy. */
  fourTier: {
    admin: ["*"] as Permission[],
    editor: contentEditor,
    author: articleAuthor,
    viewer,
  },
  /** Named permission bundles to compose custom roles. */
  permissions: { contentEditor, mediaManager, articleAuthor },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/rbac-presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rbac/presets.ts test/rbac-presets.test.ts
git commit -m "feat(rbac): ready-made role presets"
```

---

### Task 4: `buildAuthConfig` refactor

**Files:**
- Modify: `src/auth/config.ts` (whole file)
- Modify: `src/auth/index.ts:8` (import default authConfig — unchanged path, see step 3)
- Test: `test/rbac-auth-config.test.ts`

**Interfaces:**
- Consumes: `peekActiveRbac` from `../rbac/registry`.
- Produces:
  - `function buildAuthConfig(fallbackRole: string): NextAuthConfig`
  - `const authConfig: NextAuthConfig` (= `buildAuthConfig("editor")`, kept for the package's own `auth/index.ts`)

- [ ] **Step 1: Write the failing test**

```ts
// test/rbac-auth-config.test.ts
import { describe, it, expect } from "vitest";
import { buildAuthConfig } from "../src/auth/config.ts";

describe("buildAuthConfig", () => {
  it("jwt callback defaults role to fallbackRole when user has none", () => {
    const cfg = buildAuthConfig("viewer");
    const jwt = cfg.callbacks!.jwt as (a: any) => any;
    const token = jwt({ token: {}, user: { id: "1" } });
    expect(token.role).toBe("viewer");
  });
  it("jwt callback keeps an explicit user role", () => {
    const cfg = buildAuthConfig("viewer");
    const jwt = cfg.callbacks!.jwt as (a: any) => any;
    const token = jwt({ token: {}, user: { id: "1", role: "admin" } });
    expect(token.role).toBe("admin");
  });
  it("session callback copies role from token", () => {
    const cfg = buildAuthConfig("editor");
    const session = cfg.callbacks!.session as (a: any) => any;
    const out = session({ session: { user: {} }, token: { id: "7", role: "author" } });
    expect(out.user.role).toBe("author");
    expect(out.user.id).toBe("7");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-auth-config.test.ts`
Expected: FAIL — `buildAuthConfig` is not exported.

- [ ] **Step 3: Write implementation** (replace entire `src/auth/config.ts`)

```ts
// src/auth/config.ts
import type { NextAuthConfig } from "next-auth";
import { peekActiveRbac } from "../rbac/registry";

/**
 * Build the edge-safe NextAuth config. `fallbackRole` is the role assigned to
 * tokens/sessions that carry no role. The active RBAC runtime (once registered)
 * takes precedence so the consumer's fallbackRole wins even on the node path.
 */
export function buildAuthConfig(fallbackRole: string): NextAuthConfig {
  const resolveFallback = () => peekActiveRbac()?.config.fallbackRole ?? fallbackRole;
  return {
    pages: { signIn: "/admin/login" },
    session: { strategy: "jwt" },
    trustHost: true,
    providers: [], // real provider added in auth/index.ts (Node runtime)
    callbacks: {
      authorized({ auth, request: { nextUrl } }) {
        const isAdminArea = nextUrl.pathname.startsWith("/admin");
        const isLogin = nextUrl.pathname === "/admin/login";
        if (isLogin) {
          return auth?.user ? Response.redirect(new URL("/admin", nextUrl)) : true;
        }
        if (isAdminArea) return !!auth?.user;
        return true;
      },
      jwt({ token, user }) {
        if (user) {
          token.id = user.id as string;
          token.role = (user.role as string | undefined) ?? resolveFallback();
        }
        return token;
      },
      session({ session, token }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any;
        if (token.id) u.id = token.id;
        u.role = token.role ?? resolveFallback();
        return session;
      },
    },
  };
}

/** Default config used by the package's own auth/index.ts. */
export const authConfig: NextAuthConfig = buildAuthConfig("editor");
```

> Note: `src/auth/index.ts` keeps `import { authConfig } from "./config";` — no change there. The `./auth/config` package export still resolves to this module.

- [ ] **Step 4: Run test + full suite**

Run: `pnpm vitest run test/rbac-auth-config.test.ts && pnpm test`
Expected: PASS (new file) and the existing suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/auth/config.ts test/rbac-auth-config.test.ts
git commit -m "refactor(auth): buildAuthConfig(fallbackRole) factory"
```

---

### Task 5: Node guards in `auth-helpers` (`requirePermission`, drop `requireAdmin`)

**Files:**
- Modify: `src/lib/auth-helpers.ts` (whole file)
- Test: `test/rbac-guard.test.ts`

**Interfaces:**
- Consumes: `auth` from `../auth/index`, `getActiveRbac` from `../rbac/registry`, `Permission` from `../rbac/permissions`.
- Produces:
  - `async function requireUser()` (unchanged behavior)
  - `async function requireUserId(): Promise<number>` (unchanged)
  - `async function requirePermission(perm: Permission)` → returns session, redirects to `/admin` if lacking
  - **Removed:** `requireAdmin`

- [ ] **Step 1: Write the failing test**

The guard calls `auth()` and `redirect()`; mock both. Module under test imports them, so mock with `vi.mock`.

```ts
// test/rbac-guard.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const redirectMock = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });

vi.mock("../src/auth/index.ts", () => ({ auth: authMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { requirePermission } from "../src/lib/auth-helpers.ts";
import { buildRuntime, setActiveRbac } from "../src/rbac/registry.ts";

beforeEach(() => {
  authMock.mockReset();
  redirectMock.mockClear();
  setActiveRbac(buildRuntime({
    roles: { admin: ["*"], editor: ["articles.read"] },
    fallbackRole: "editor",
    protectedPermission: "users.delete",
  }));
});

describe("requirePermission", () => {
  it("returns session when the role grants the permission", async () => {
    authMock.mockResolvedValue({ user: { id: "1", role: "admin" } });
    const session = await requirePermission("users.delete");
    expect(session.user.role).toBe("admin");
    expect(redirectMock).not.toHaveBeenCalled();
  });
  it("redirects to /admin/login when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    await expect(requirePermission("articles.read")).rejects.toThrow("REDIRECT:/admin/login");
  });
  it("redirects to /admin when authenticated but lacking permission", async () => {
    authMock.mockResolvedValue({ user: { id: "2", role: "editor" } });
    await expect(requirePermission("users.delete")).rejects.toThrow("REDIRECT:/admin");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-guard.test.ts`
Expected: FAIL — `requirePermission` not exported.

- [ ] **Step 3: Write implementation** (replace entire `src/lib/auth-helpers.ts`)

```ts
// src/lib/auth-helpers.ts
import { redirect } from "next/navigation";
import { auth } from "../auth/index";
import { getActiveRbac } from "../rbac/registry";
import type { Permission } from "../rbac/permissions";

/** Any authenticated user. Returns the session. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session;
}

/** Authenticated user ID as integer (matches DB `serial` columns). */
export async function requireUserId(): Promise<number> {
  const session = await requireUser();
  const id = Number(session.user.id);
  if (!Number.isInteger(id)) throw new Error("Invalid user ID");
  return id;
}

/**
 * Require a specific permission. Redirects unauthenticated users to login and
 * authenticated-but-unauthorized users to the dashboard. Resolves role →
 * permissions through the active RBAC runtime.
 */
export async function requirePermission(perm: Permission) {
  const session = await requireUser();
  const role = (session.user as { role?: string }).role ?? null;
  if (!getActiveRbac().can(role, perm)) redirect("/admin");
  return session;
}
```

- [ ] **Step 4: Run test + full suite**

Run: `pnpm vitest run test/rbac-guard.test.ts && pnpm test`
Expected: new file PASS. The existing suite will still pass (no test imports `requireAdmin`). Screens that import `requireAdmin` are not type-checked by Vitest yet — they are fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-helpers.ts test/rbac-guard.test.ts
git commit -m "feat(rbac): requirePermission guard, drop requireAdmin"
```

---

### Task 6: `defineRbac` bundle + barrel + package export

**Files:**
- Create: `src/rbac/nav.ts` (shared pure nav filter — used by both the bundle and `shell/layout.tsx`)
- Create: `src/rbac/define-rbac.ts`
- Create: `src/rbac/index.ts`
- Modify: `package.json` (add `./rbac` export, bump version)
- Test: `test/rbac-define.test.ts`

**Interfaces:**
- Consumes: `presets` (Task 3), `buildRuntime`/`setActiveRbac` (Task 2), `buildAuthConfig` (Task 4), `hasPermission` (Task 1), `NavItem` type (from `../shell/sidebar`, type-only).
- Produces:
  - `type RbacConfig = { roles: Record<string, Permission[]>; fallbackRole: string; protectedPermission: Permission }`
  - `type RbacBundle = { config; authConfig; permissionsFor; can; filterNav; requireUser; requireUserId; requirePermission }`
  - `function defineRbac(config: RbacConfig): RbacBundle`
  - barrel `src/rbac/index.ts` re-exports `defineRbac`, `presets`, `matches`, `hasPermission`, and types.

> `NavItem` already exists in `src/shell/sidebar.tsx`; the `requires?: Permission` field is added in Task 9. `filterNav` only reads `item.requires` and `item.children`, both optional, so it compiles before Task 9.

- [ ] **Step 1: Write the failing test**

```ts
// test/rbac-define.test.ts
import { describe, it, expect } from "vitest";
import { defineRbac } from "../src/rbac/define-rbac.ts";
import { presets } from "../src/rbac/presets.ts";
import { getActiveRbac } from "../src/rbac/registry.ts";

describe("defineRbac", () => {
  it("registers the active runtime", () => {
    defineRbac({ roles: { admin: ["*"] }, fallbackRole: "admin", protectedPermission: "users.delete" });
    expect(getActiveRbac().config.fallbackRole).toBe("admin");
  });
  it("throws when fallbackRole is not a defined role", () => {
    expect(() =>
      defineRbac({ roles: { admin: ["*"] }, fallbackRole: "ghost", protectedPermission: "users.delete" }),
    ).toThrow(/fallbackRole/);
  });
  it("can() resolves through the bundle", () => {
    const rbac = defineRbac({
      roles: { ...presets.adminEditor },
      fallbackRole: "editor",
      protectedPermission: "users.delete",
    });
    expect(rbac.can("admin", "users.delete")).toBe(true);
    expect(rbac.can("editor", "users.delete")).toBe(false);
  });
  it("filterNav drops items the role cannot access", () => {
    const rbac = defineRbac({
      roles: { admin: ["*"], editor: ["articles.read"] },
      fallbackRole: "editor",
      protectedPermission: "users.delete",
    });
    const nav = [
      { label: "Articles", href: "/a", requires: "articles.read" },
      { label: "Users", href: "/u", requires: "users.read" },
      { label: "Home", href: "/" },
    ];
    const out = rbac.filterNav(nav as any, "editor");
    expect(out.map((i) => i.label)).toEqual(["Articles", "Home"]);
  });
  it("filterNav recurses into children and drops empty groups", () => {
    const rbac = defineRbac({
      roles: { admin: ["*"], editor: ["articles.read"] },
      fallbackRole: "editor",
      protectedPermission: "users.delete",
    });
    const nav = [
      { label: "Manage", children: [{ label: "Users", href: "/u", requires: "users.read" }] },
    ];
    expect(rbac.filterNav(nav as any, "editor")).toEqual([]);
  });
  it("exposes the produced authConfig", () => {
    const rbac = defineRbac({ roles: { admin: ["*"] }, fallbackRole: "admin", protectedPermission: "users.delete" });
    expect(rbac.authConfig.callbacks?.jwt).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-define.test.ts`
Expected: FAIL — cannot find module `../src/rbac/define-rbac.ts`.

- [ ] **Step 3: Write implementation**

First create the shared pure nav filter:

```ts
// src/rbac/nav.ts
import type { NavItem } from "../shell/sidebar";

/**
 * Drop nav items whose `requires` permission is not allowed; recurse into
 * children and drop groups that become empty. Pure + edge-safe (type-only
 * NavItem import is erased at compile). Shared by the defineRbac bundle and
 * the server-side AdminLayout so the logic lives in exactly one place.
 */
export function filterNavItems(items: NavItem[], allow: (perm: string) => boolean): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.requires && !allow(item.requires)) continue;
    if (item.children) {
      const children = filterNavItems(item.children, allow);
      if (children.length === 0) continue;
      out.push({ ...item, children });
    } else {
      out.push(item);
    }
  }
  return out;
}
```

Then the bundle:

```ts
// src/rbac/define-rbac.ts
import type { NextAuthConfig, Session } from "next-auth";
import type { NavItem } from "../shell/sidebar";
import { buildAuthConfig } from "../auth/config";
import { hasPermission, type Permission } from "./permissions";
import { buildRuntime, setActiveRbac } from "./registry";
import { filterNavItems } from "./nav";

export type RbacConfig = {
  roles: Record<string, Permission[]>;
  fallbackRole: string;
  protectedPermission: Permission;
};

export type RbacBundle = {
  config: RbacConfig;
  authConfig: NextAuthConfig;
  permissionsFor: (role: string) => string[];
  can: (role: string | null | undefined, perm: Permission) => boolean;
  filterNav: (items: NavItem[], role: string) => NavItem[];
  requireUser: () => Promise<Session>;
  requireUserId: () => Promise<number>;
  requirePermission: (perm: Permission) => Promise<Session>;
};

/**
 * Define the consumer's RBAC. Returns an edge-safe bundle AND registers the
 * runtime so the package's built-in screens can resolve permissions. Import the
 * module that calls this in middleware (edge) and the admin root layout (node).
 */
export function defineRbac(config: RbacConfig): RbacBundle {
  if (!config.roles[config.fallbackRole]) {
    throw new Error(`@blawness/admin-kit: fallbackRole "${config.fallbackRole}" is not a defined role.`);
  }
  const runtime = buildRuntime(config);
  setActiveRbac(runtime);

  const can = (role: string | null | undefined, perm: Permission): boolean =>
    hasPermission(runtime.permissionsFor(role ?? config.fallbackRole), perm);

  return {
    config,
    authConfig: buildAuthConfig(config.fallbackRole),
    permissionsFor: runtime.permissionsFor,
    can,
    filterNav: (items, role) => filterNavItems(items, (perm) => can(role, perm)),
    // Node-only guards reached via dynamic import to keep this module edge-safe.
    requireUser: async () => (await import("../lib/auth-helpers")).requireUser(),
    requireUserId: async () => (await import("../lib/auth-helpers")).requireUserId(),
    requirePermission: async (perm) => (await import("../lib/auth-helpers")).requirePermission(perm),
  };
}
```

```ts
// src/rbac/index.ts
export { defineRbac } from "./define-rbac";
export type { RbacConfig, RbacBundle } from "./define-rbac";
export { presets } from "./presets";
export { matches, hasPermission } from "./permissions";
export type { Permission, BuiltInPermission } from "./permissions";
```

- [ ] **Step 4: Add the package export + version bump**

In `package.json`, bump `"version": "0.7.3"` → `"version": "0.8.0"`, and add to `"exports"` (next to `"./auth-helpers"`):

```json
    "./rbac": {
      "types": "./dist/rbac/index.d.ts",
      "default": "./dist/rbac/index.js"
    },
```

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm vitest run test/rbac-define.test.ts && pnpm typecheck`
Expected: test PASS. `pnpm typecheck` will still report errors in screen files that import `requireAdmin` and in `NavItem.requires` usages — those are fixed in Tasks 7–10. Confirm there are **no** errors inside `src/rbac/**` or `src/auth/config.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/rbac/define-rbac.ts src/rbac/index.ts package.json test/rbac-define.test.ts
git commit -m "feat(rbac): defineRbac bundle, ./rbac export, v0.8.0"
```

---

### Task 7: Generalize last-admin guard → last-protected-user (`admin/users.ts`)

**Files:**
- Modify: `src/lib/admin/users.ts` (lines 24–30 `countAdmins`, 39 `UserRole`, 56–70 `updateUserRole`, 72–85 `deleteUser`)
- Test: `test/rbac-protected-user.test.ts`

**Interfaces:**
- Consumes: `getActiveRbac` from `../../rbac/registry`, `hasPermission` from `../../rbac/permissions`.
- Produces:
  - `type UserRole = string` (was `"admin" | "editor"`)
  - `function rolesGranting(perm: string): string[]` (exported, pure, for tests + actions)
  - `LastAdminError` / `isLastAdminError` unchanged (message stays Indonesian)

- [ ] **Step 1: Write the failing test** (pure `rolesGranting`)

```ts
// test/rbac-protected-user.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildRuntime, setActiveRbac } from "../src/rbac/registry.ts";
import { rolesGranting } from "../src/lib/admin/users.ts";

beforeEach(() => {
  setActiveRbac(buildRuntime({
    roles: { superadmin: ["*"], manager: ["users.delete", "users.read"], author: ["articles.read"] },
    fallbackRole: "author",
    protectedPermission: "users.delete",
  }));
});

describe("rolesGranting", () => {
  it("returns every role whose permissions cover the permission", () => {
    expect(rolesGranting("users.delete").sort()).toEqual(["manager", "superadmin"]);
  });
  it("returns only wildcard roles for an unlisted permission", () => {
    expect(rolesGranting("reports.export")).toEqual(["superadmin"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/rbac-protected-user.test.ts`
Expected: FAIL — `rolesGranting` not exported.

- [ ] **Step 3: Write implementation** — edit `src/lib/admin/users.ts`

Add imports at the top (after existing imports):

```ts
import { getActiveRbac } from "../../rbac/registry";
import { hasPermission } from "../../rbac/permissions";
```

Replace `countAdmins` (lines 24–30) with:

```ts
/** Roles whose permission set covers `perm`. Pure; reads the active config. */
export function rolesGranting(perm: string): string[] {
  const { config } = getActiveRbac();
  return Object.keys(config.roles).filter((role) => hasPermission(config.roles[role], perm));
}

// How many users hold `perm` (via their role) inside the running transaction.
async function countUsersWith(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  perm: string,
): Promise<number> {
  const roles = rolesGranting(perm);
  if (roles.length === 0) return 0;
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(inArray(users.role, roles));
  return row?.count ?? 0;
}
```

Update the `drizzle-orm` import (line 3) to add `inArray`:

```ts
import { asc, eq, sql, inArray } from "drizzle-orm";
```

Change `UserRole` (line 39):

```ts
export type UserRole = string;
```

Replace `updateUserRole` (lines 56–70) with:

```ts
export async function updateUserRole(id: number, role: UserRole) {
  const { config } = getActiveRbac();
  const protectedPerm = config.protectedPermission;
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id));
    const targetHadProtection = target?.role ? hasPermission(config.roles[target.role] ?? [], protectedPerm) : false;
    const newRoleHasProtection = hasPermission(config.roles[role] ?? [], protectedPerm);
    // Removing protection from the last user who has it would cause a lockout.
    if (targetHadProtection && !newRoleHasProtection && (await countUsersWith(tx, protectedPerm)) <= 1) {
      throw new LastAdminError();
    }
    await tx.update(users).set({ role }).where(eq(users.id, id));
  });
}
```

Replace `deleteUser` (lines 72–85) with:

```ts
export async function deleteUser(id: number) {
  const { config } = getActiveRbac();
  const protectedPerm = config.protectedPermission;
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id));
    if (!target) return;
    const hadProtection = target.role ? hasPermission(config.roles[target.role] ?? [], protectedPerm) : false;
    if (hadProtection && (await countUsersWith(tx, protectedPerm)) <= 1) {
      throw new LastAdminError();
    }
    await tx.delete(users).where(eq(users.id, id));
  });
}
```

- [ ] **Step 4: Run test + full suite**

Run: `pnpm vitest run test/rbac-protected-user.test.ts && pnpm test`
Expected: new test PASS; `test/last-admin.test.ts` still PASS (class unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/users.ts test/rbac-protected-user.test.ts
git commit -m "feat(rbac): last-protected-user guard replaces last-admin count"
```

---

### Task 8: Migrate screen/action gating (`requireAdmin` → `requirePermission`)

**Files:**
- Modify: `src/screens/users/actions.ts` (4 `requireAdmin` calls + role validation, lines 6, 15, 19, 57, 71–75, 95)
- Modify: `src/screens/users/page.tsx` (line 1 import, line 22 call, line 49 role `<select>` options)
- Modify: `src/screens/categories/actions.ts` (lines 5, 18, 46, 60, 87)
- Modify: `src/screens/categories/page.tsx` (lines 1, 19)
- Modify: `src/screens/articles/actions.ts` (lines 6, 185, 206, 227; keep `requireUser` ones)
- Modify: `src/screens/articles/page.tsx` (line 38 `isAdmin`)
- Modify: `src/screens/articles/form.tsx` (line 20 `isAdmin`)
- Modify: `src/screens/articles/article-form.tsx` (line 59 `isAdmin`)

**Interfaces:**
- Consumes: `requirePermission` (Task 5), `getActiveRbac` (Task 2).

> Permission mapping (from spec §6.1): users page=`users.read`, create=`users.create`, setRole=`users.update`, resetPassword=`users.update`, delete=`users.delete`; categories page=`categories.read`, create/update/delete=`categories.{create,update,delete}`; articles publish/reject=`articles.publish`, delete=`articles.delete`. `isAdmin` booleans become capability checks via `getActiveRbac().can(role, "articles.publish")`.

- [ ] **Step 1: Edit `src/screens/users/actions.ts`**

Line 6 — replace import:
```ts
import { requirePermission } from "../../lib/auth-helpers";
```
Line 15 — make role schema accept any configured role:
```ts
  role: z.string().min(1),
```
Add a helper above `createUserAction` (after line 16):
```ts
import { getActiveRbac } from "../../rbac/registry";
const isKnownRole = (role: string) => role in getActiveRbac().config.roles;
```
Line 19 — `createUserAction`:
```ts
  const session = await requirePermission("users.create");
```
After parsing in `createUserAction`, reject unknown roles. Replace the `const { email, name, password, role } = parsed.data;` line with:
```ts
  const { email, name, password, role } = parsed.data;
  if (!isKnownRole(role)) redirect(`/admin/users?error=Role+tidak+dikenal${keep}`);
```
Line 57 — `resetPasswordAction`:
```ts
  const session = await requirePermission("users.update");
```
Line 72 — `setRoleAction`:
```ts
  const session = await requirePermission("users.update");
```
Lines 74–75 — accept any known role:
```ts
  const role = String(formData.get("role") ?? "");
  if (!id || !isKnownRole(role)) return;
```
Line 95 — `deleteUserAction`:
```ts
  const session = await requirePermission("users.delete");
```

- [ ] **Step 2: Edit `src/screens/users/page.tsx`**

Line 1:
```ts
import { requirePermission } from "../../lib/auth-helpers";
import { getActiveRbac } from "../../rbac/registry";
```
Line 22:
```ts
  const session = await requirePermission("users.read");
```
Line 49 — render role options from config instead of hardcoded admin/editor. Replace the `<select>`:
```tsx
        <select name="role" className={selectClass} defaultValue={role}>
          {Object.keys(getActiveRbac().config.roles).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
```

- [ ] **Step 3: Edit `src/screens/categories/actions.ts`**

Line 5:
```ts
import { requirePermission } from "../../lib/auth-helpers";
```
Line 18 (`createCategoryAction`):
```ts
  const session = await requirePermission("categories.create");
```
Line 46 — locate the action and set the matching permission: `deleteCategoryAction` → `"categories.delete"`; `createTagAction` → `"categories.create"`; `deleteTagAction` → `"categories.delete"`. (Inspect each function's name; use `categories.create` for create*, `categories.delete` for delete*.)
Line 60, 87 — same rule by function name.

- [ ] **Step 4: Edit `src/screens/categories/page.tsx`**

Line 1:
```ts
import { requirePermission } from "../../lib/auth-helpers";
```
Line 19:
```ts
  await requirePermission("categories.read");
```

- [ ] **Step 5: Edit `src/screens/articles/actions.ts`**

Line 6 — keep both, swap requireAdmin:
```ts
import { requireUser, requirePermission } from "../../lib/auth-helpers";
```
Line 185 (`publishArticleAction`):
```ts
  const session = await requirePermission("articles.publish");
```
Line 206 (`rejectArticleAction`):
```ts
  const session = await requirePermission("articles.publish");
```
Line 227 (`deleteArticleAction`):
```ts
  const session = await requirePermission("articles.delete");
```
Line ~146 — the `isAdmin: session.user.role === "admin"` flag becomes a capability check. Add import at top:
```ts
import { getActiveRbac } from "../../rbac/registry";
```
and replace `isAdmin: session.user.role === "admin"` with:
```ts
      { userId: Number(session.user.id), isAdmin: getActiveRbac().can(session.user.role, "articles.publish") }
```

- [ ] **Step 6: Edit the three `isAdmin` UI spots**

`src/screens/articles/page.tsx:38`:
```tsx
  const isAdmin = (await import("../../rbac/registry")).getActiveRbac().can(session.user.role, "articles.publish");
```
(or add a top-level `import { getActiveRbac } from "../../rbac/registry";` and use `getActiveRbac().can(session.user.role, "articles.publish")`).

`src/screens/articles/form.tsx:20`:
```tsx
  const isAdmin = getActiveRbac().can(session.user.role, "articles.publish");
```
with `import { getActiveRbac } from "../../rbac/registry";` added.

`src/screens/articles/article-form.tsx:59` — this is a client component receiving `role` as a prop. Do **not** import the registry here. Instead, change the component to accept an `canPublish: boolean` prop computed by its server parent (`form.tsx`) and replace `const isAdmin = role === "admin";` with `const isAdmin = canPublish;`. Update `form.tsx` to pass `canPublish={isAdmin}` where it renders `article-form`.

- [ ] **Step 7: Run full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: tests PASS. `pnpm typecheck` errors now limited to `NavItem.requires` (Task 9) and the demo (Task 11) — confirm no remaining `requireAdmin` references: `grep -rn "requireAdmin" src` returns nothing.

- [ ] **Step 8: Commit**

```bash
git add src/screens
git commit -m "feat(rbac): gate built-in screens with requirePermission"
```

---

### Task 9: Sidebar + layout permission filtering

**Files:**
- Modify: `src/shell/sidebar.tsx` (line 14 `adminOnly`, lines 32–33 + 119 filters, `NavGroup`/`AdminSidebar` props)
- Modify: `src/shell/layout.tsx` (line 29 — filter nav before render)

**Interfaces:**
- Consumes: `getActiveRbac` (Task 2) in `layout.tsx` (server component).
- Produces: `NavItem.requires?: Permission`; sidebar no longer reads `role === "admin"`.

> The sidebar is a client component; it must NOT import the registry. The server `AdminLayout` filters items via `getActiveRbac().can(...)` and passes the already-filtered list down. The sidebar keeps `role` only for the role badge, not for filtering.

- [ ] **Step 1: Edit `src/shell/sidebar.tsx`**

Line 10–15 — change the type:
```ts
export type NavItem = {
  href?: string;
  label: string;
  icon?: ReactNode;
  requires?: string;
  children?: NavItem[];
};
```
Lines 32–33 — `NavGroup` no longer filters by role; it receives pre-filtered items. Replace:
```ts
  const visible = item.children;
```
Line 119 — `AdminSidebar` renders items as-is (already filtered). Replace the `.filter((l) => !l.adminOnly || role === "admin")` with no filter:
```tsx
        {navItems.map((item) => (
```
Remove the now-unused `role` parameter from `NavGroup` (lines 20, 24) and its `role={role}` pass-down (line 125). Keep `role` on `AdminSidebar` for the badge only (if it uses it; otherwise drop it too — see layout).

- [ ] **Step 2: Edit `src/shell/layout.tsx`**

Add imports (reuse the shared pure filter from Task 6 — do NOT redefine it here):
```ts
import { getActiveRbac } from "../rbac/registry";
import { filterNavItems } from "../rbac/nav";
```
Replace line 29 with a filtered nav:
```tsx
  const role = session.user.role;
  const rbac = getActiveRbac();
  const visibleNav = filterNavItems(navItems, (perm) => rbac.can(role, perm));
  return (
    <div className="flex min-h-screen bg-navy-50/60">
      <AdminSidebar role={role} navItems={visibleNav} logoSrc={logoSrc} brandName={brandName} />
```
`src/rbac/nav.ts` is pure (type-only `NavItem` import erased at compile), so importing it into the server `AdminLayout` pulls no client code.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors in `src/shell/**`. Remaining errors only in the demo example (Task 11).

- [ ] **Step 4: Commit**

```bash
git add src/shell/sidebar.tsx src/shell/layout.tsx
git commit -m "feat(rbac): permission-based sidebar nav filtering"
```

---

### Task 10: Build verification (package)

**Files:** none (verification task)

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: `tsc -p tsconfig.json` completes with **zero errors**. `dist/rbac/index.js`, `dist/rbac/define-rbac.js`, etc. exist.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: all suites PASS (existing + 6 new rbac test files).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Confirm no stale references**

Run: `grep -rn "requireAdmin\|adminOnly" src`
Expected: no matches.

- [ ] **Step 5: Commit (if dist tracked) / tag-free checkpoint**

```bash
git add -A
git commit -m "chore(rbac): build + lint verification" --allow-empty
```

---

### Task 11: Update the demo example + migration guide

**Files:**
- Create: `examples/demo/rbac.ts`
- Modify: `examples/demo/middleware.ts`
- Modify: `examples/demo/app/(admin)/admin/layout.tsx`
- Modify: `examples/demo/app/(admin)/admin/users/page.tsx` and any nav definitions using `adminOnly`
- Create: `docs/MIGRATION-0.8.md`

**Interfaces:**
- Consumes: `defineRbac`, `presets` from `@blawness/admin-kit/rbac`.

- [ ] **Step 1: Create `examples/demo/rbac.ts`**

```ts
import { defineRbac, presets } from "@blawness/admin-kit/rbac";

export const rbac = defineRbac({
  roles: {
    ...presets.adminEditor, // admin + editor
    author: presets.permissions.articleAuthor,
  },
  fallbackRole: "editor",
  protectedPermission: "users.delete",
});
```

- [ ] **Step 2: Update `examples/demo/middleware.ts`**

```ts
import NextAuth from "next-auth";
import { rbac } from "./rbac";

export const { auth: middleware } = NextAuth(rbac.authConfig);
export const config = { matcher: ["/admin/:path*"] };
```

- [ ] **Step 3: Register on the node side in the admin layout**

In `examples/demo/app/(admin)/admin/layout.tsx`, add a side-effect import at the top so `defineRbac` runs in the node runtime:

```ts
import "../../../rbac";
```

(Adjust the relative depth so it points at `examples/demo/rbac.ts`.)

- [ ] **Step 4: Replace any `adminOnly: true` nav entries with `requires`**

Search the demo for nav item definitions: `grep -rn "adminOnly" examples/demo`. For each, replace `adminOnly: true` with the appropriate permission, e.g. `requires: "users.read"` for the Users link.

- [ ] **Step 5: Write `docs/MIGRATION-0.8.md`**

````markdown
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
- Admin root layout: add `import "./rbac"` (side effect) so the config registers in the node runtime.

## 3. Replace gating in your own code
- `requireAdmin()` → `requirePermission("<perm>")` from `@blawness/admin-kit/auth-helpers`.
- Nav items: `adminOnly: true` → `requires: "<perm>"`.

## 4. Data
The `users.role` column is unchanged. Existing `admin`/`editor` rows keep working
as long as those role names exist in your `defineRbac` config (they do if you use
`presets.adminEditor`). If you rename roles, `UPDATE users SET role = ...` accordingly.
````

- [ ] **Step 6: Verify the demo builds**

Run: `cd examples/demo && pnpm build`
Expected: build succeeds (no `requireAdmin` / `adminOnly` / `authConfig` import errors).

- [ ] **Step 7: Commit**

```bash
git add examples/demo docs/MIGRATION-0.8.md
git commit -m "docs(rbac): migrate demo to defineRbac + 0.8 migration guide"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** §3 permission model → Task 1; §4 defineRbac/bundle/presets → Tasks 3, 6; §5 data flow (role-only token) → Task 4 callbacks; §6.1 screen gating → Task 8; §6.2 sidebar → Task 9; §6.3 fallbackRole → Task 4; §6.4 last-protected guard → Task 7; §6.5 migration → Task 11; §7 file list → matches Tasks; §8 testing → each task's tests.
- **Edge-safety invariant:** only `src/lib/auth-helpers.ts` and `src/lib/admin/users.ts` statically import node modules. `src/rbac/**` and `src/auth/config.ts` must stay free of static `../auth/index` / `../db/index` imports — verify with `grep -n "auth/index\|db/index" src/rbac/*.ts src/auth/config.ts` (expected: no matches).
- **Type consistency:** `RbacRuntime`, `ResolvedRbacConfig`, `RbacConfig`, `RbacBundle`, `Permission` names are used identically across Tasks 1–9.
