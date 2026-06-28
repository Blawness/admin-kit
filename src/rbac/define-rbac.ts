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
