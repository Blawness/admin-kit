"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "../../lib/auth-helpers";
import { isUniqueViolation } from "../../lib/db-errors";
import {
  createCategory,
  deleteCategory,
  createTag,
  deleteTag,
} from "../../lib/admin/categories";

const nameSchema = z.string().min(1, "Nama tidak boleh kosong").max(100);

export async function createCategoryAction(fd: FormData) {
  await requireAdmin();
  const name = String(fd.get("name") ?? "");
  const result = nameSchema.safeParse(fd.get("name"));
  if (!result.success) {
    // Preserve the attempted value so the form can pre-fill on error.
    redirect(
      `/admin/categories?error=${encodeURIComponent(result.error.issues[0].message)}&catName=${encodeURIComponent(name)}`,
    );
  }
  try {
    await createCategory(result.data);
  } catch (e) {
    const msg = isUniqueViolation(e) ? "Kategori sudah ada." : "Terjadi kesalahan, coba lagi.";
    redirect(
      `/admin/categories?error=${encodeURIComponent(msg)}&catName=${encodeURIComponent(name)}`,
    );
  }
  redirect("/admin/categories");
}

export async function deleteCategoryAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/categories");
  await deleteCategory(id);
  redirect("/admin/categories");
}

export async function createTagAction(fd: FormData) {
  await requireAdmin();
  const name = String(fd.get("name") ?? "");
  const result = nameSchema.safeParse(fd.get("name"));
  if (!result.success) {
    redirect(
      `/admin/categories?error=${encodeURIComponent(result.error.issues[0].message)}&tagName=${encodeURIComponent(name)}`,
    );
  }
  try {
    await createTag(result.data);
  } catch (e) {
    const msg = isUniqueViolation(e) ? "Tag sudah ada." : "Terjadi kesalahan, coba lagi.";
    redirect(
      `/admin/categories?error=${encodeURIComponent(msg)}&tagName=${encodeURIComponent(name)}`,
    );
  }
  redirect("/admin/categories");
}

export async function deleteTagAction(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  if (!id || isNaN(id)) redirect("/admin/categories");
  await deleteTag(id);
  redirect("/admin/categories");
}
