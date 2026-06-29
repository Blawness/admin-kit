"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "../../lib/auth-helpers";
import { isUniqueViolation } from "../../lib/db-errors";
import {
  createCategory,
  deleteCategory,
  createTag,
  deleteTag,
} from "../../lib/admin/categories";
import { logAudit } from "../../lib/audit";

const nameSchema = z.string().min(1, "Nama tidak boleh kosong").max(100);

export async function createCategoryAction(fd: FormData) {
  const session = await requirePermission("categories.create");
  const name = String(fd.get("name") ?? "");
  const result = nameSchema.safeParse(fd.get("name"));
  if (!result.success) {
    // Preserve the attempted value so the form can pre-fill on error.
    redirect(
      `/admin/categories?error=${encodeURIComponent(result.error.issues[0].message)}&catName=${encodeURIComponent(name)}`,
    );
  }
  try {
    const row = await createCategory(result.data);
    logAudit({
      actorId: Number(session.user.id),
      action: "category.create",
      entityType: "category",
      entityId: row.id,
      metadata: { name: result.data },
    }).catch(() => {});
  } catch (e) {
    const msg = isUniqueViolation(e) ? "Kategori sudah ada." : "Terjadi kesalahan, coba lagi.";
    redirect(
      `/admin/categories?error=${encodeURIComponent(msg)}&catName=${encodeURIComponent(name)}`,
    );
  }
  redirect("/admin/categories");
}

export async function deleteCategoryAction(fd: FormData) {
  const session = await requirePermission("categories.delete");
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/categories");
  await deleteCategory(id);
  logAudit({
    actorId: Number(session.user.id),
    action: "category.delete",
    entityType: "category",
    entityId: id,
  }).catch(() => {});
  redirect("/admin/categories");
}

export async function createTagAction(fd: FormData) {
  const session = await requirePermission("categories.create");
  const name = String(fd.get("name") ?? "");
  const result = nameSchema.safeParse(fd.get("name"));
  if (!result.success) {
    redirect(
      `/admin/categories?error=${encodeURIComponent(result.error.issues[0].message)}&tagName=${encodeURIComponent(name)}`,
    );
  }
  try {
    const row = await createTag(result.data);
    logAudit({
      actorId: Number(session.user.id),
      action: "tag.create",
      entityType: "tag",
      entityId: row.id,
      metadata: { name: result.data },
    }).catch(() => {});
  } catch (e) {
    const msg = isUniqueViolation(e) ? "Tag sudah ada." : "Terjadi kesalahan, coba lagi.";
    redirect(
      `/admin/categories?error=${encodeURIComponent(msg)}&tagName=${encodeURIComponent(name)}`,
    );
  }
  redirect("/admin/categories");
}

export async function deleteTagAction(fd: FormData) {
  const session = await requirePermission("categories.delete");
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/categories");
  await deleteTag(id);
  logAudit({
    actorId: Number(session.user.id),
    action: "tag.delete",
    entityType: "tag",
    entityId: id,
  }).catch(() => {});
  redirect("/admin/categories");
}
