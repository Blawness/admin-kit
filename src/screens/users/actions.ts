"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { getActiveRbac } from "../../rbac/registry";
import { isUniqueViolation, isForeignKeyViolation } from "../../lib/db-errors";
import { createUser, updateUserPassword, updateUserRole, deleteUser, isLastAdminError } from "../../lib/admin/users";
import { logAudit } from "../../lib/audit";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.string().min(1),
});

const isKnownRole = (role: string) => role in getActiveRbac().config.roles;

export async function createUserAction(formData: FormData) {
  const session = await requirePermission("users.create");
  const rawEmail = String(formData.get("email") ?? "");
  const rawName = String(formData.get("name") ?? "");
  const rawRole = String(formData.get("role") ?? "");
  // Preserve non-secret fields on error so the form can pre-fill them.
  // Never echo back the password.
  const keep = `&email=${encodeURIComponent(rawEmail)}&name=${encodeURIComponent(rawName)}&role=${encodeURIComponent(rawRole)}`;
  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect(
      `/admin/users?error=Data+tidak+valid+(email+benar,+password+min+8+karakter)${keep}`,
    );
  }
  const { email, name, password, role } = parsed.data;
  if (!isKnownRole(role)) redirect(`/admin/users?error=Role+tidak+dikenal${keep}`);
  try {
    const user = await createUser(email, name, password, role);
    logAudit({
      actorId: Number(session.user.id),
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      metadata: { email, role },
    }).catch(() => {});
  } catch (e) {
    if (isUniqueViolation(e)) {
      redirect(`/admin/users?error=Email+sudah+terdaftar${keep}`);
    }
    throw e;
  }
  revalidatePath("/admin/users");
}

export async function resetPasswordAction(formData: FormData) {
  const session = await requirePermission("users.update");
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 8) return;
  await updateUserPassword(id, password);
  logAudit({
    actorId: Number(session.user.id),
    action: "user.reset_password",
    entityType: "user",
    entityId: id,
  }).catch(() => {});
  revalidatePath("/admin/users");
}

export async function setRoleAction(formData: FormData) {
  const session = await requirePermission("users.update");
  const id = Number(formData.get("id"));
  const role = String(formData.get("role") ?? "");
  if (!id || !isKnownRole(role)) return;
  try {
    await updateUserRole(id, role);
    logAudit({
      actorId: Number(session.user.id),
      action: "user.set_role",
      entityType: "user",
      entityId: id,
      metadata: { role },
    }).catch(() => {});
  } catch (e) {
    if (isLastAdminError(e)) {
      redirect("/admin/users?error=Tidak+bisa+menurunkan+admin+terakhir");
    }
    throw e;
  }
  revalidatePath("/admin/users");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requirePermission("users.delete");
  const id = Number(formData.get("id"));
  if (!id || id === Number(session.user.id)) return; // never delete yourself / invalid id
  try {
    await deleteUser(id);
    logAudit({
      actorId: Number(session.user.id),
      action: "user.delete",
      entityType: "user",
      entityId: id,
    }).catch(() => {});
  } catch (e) {
    if (isLastAdminError(e)) {
      redirect("/admin/users?error=Tidak+bisa+menghapus+admin+terakhir");
    }
    if (isForeignKeyViolation(e)) {
      redirect("/admin/users?error=User+ini+masih+menjadi+penulis+berita");
    }
    throw e;
  }
  revalidatePath("/admin/users");
}
