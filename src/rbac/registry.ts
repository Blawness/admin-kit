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
