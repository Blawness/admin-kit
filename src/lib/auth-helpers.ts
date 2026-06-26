import { redirect } from "next/navigation";
import { auth } from "../auth/index";

/** Any authenticated user (admin or editor). Returns the session. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session;
}

/**
 * Authenticated user ID as integer (matches DB `serial` columns).
 * Thin wrapper around requireUser — use this in mutations instead of
 * `Number(session.user.id)` everywhere.
 */
export async function requireUserId(): Promise<number> {
  const session = await requireUser();
  const id = Number(session.user.id);
  if (!Number.isInteger(id)) throw new Error("Invalid user ID");
  return id;
}

/** Admin only. Editors are sent to the dashboard. */
export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "admin") redirect("/admin");
  return session;
}
