"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "../../lib/auth-helpers";
import { isUniqueViolation, isForeignKeyViolation } from "../../lib/db-errors";
import { createUser, updateUserPassword, updateUserRole, deleteUser } from "../../lib/admin/users";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "editor"]),
});

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect("/admin/users?error=Data+tidak+valid+(email+benar,+password+min+8+karakter)");
  }
  const { email, name, password, role } = parsed.data;
  try {
    await createUser(email, name, password, role);
  } catch (e) {
    if (isUniqueViolation(e)) {
      redirect("/admin/users?error=Email+sudah+terdaftar");
    }
    throw e;
  }
  revalidatePath("/admin/users");
}

export async function resetPasswordAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 8) return;
  await updateUserPassword(id, password);
  revalidatePath("/admin/users");
}

export async function setRoleAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const role = String(formData.get("role") ?? "");
  if (!id || (role !== "admin" && role !== "editor")) return;
  await updateUserRole(id, role);
  revalidatePath("/admin/users");
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!id || id === Number(session.user.id)) return; // never delete yourself / invalid id
  try {
    await deleteUser(id);
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      redirect("/admin/users?error=User+ini+masih+menjadi+penulis+berita");
    }
    throw e;
  }
  revalidatePath("/admin/users");
}
