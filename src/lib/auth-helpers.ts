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
