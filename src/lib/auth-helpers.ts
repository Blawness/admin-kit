import { redirect } from "next/navigation";
import { auth } from "../auth/index";

/** Any authenticated user (admin or editor). Returns the session. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session;
}

/** Admin only. Editors are sent to the dashboard. */
export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "admin") redirect("/admin");
  return session;
}
