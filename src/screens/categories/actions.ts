"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "../../lib/auth-helpers";
import {
  createCategory,
  deleteCategory,
  createTag,
  deleteTag,
} from "../../lib/admin/categories";

const nameSchema = z.string().min(1, "Nama tidak boleh kosong").max(100);

export async function createCategoryAction(fd: FormData) {
  await requireAdmin();
  const result = nameSchema.safeParse(fd.get("name"));
  if (!result.success) {
    redirect(`/admin/categories?error=${encodeURIComponent(result.error.issues[0].message)}`);
  }
  try {
    await createCategory(result.data);
  } catch (e) {
    const isUniqueViolation = (e as { code?: string }).code === "23505";
    const msg = isUniqueViolation ? "Kategori sudah ada." : "Terjadi kesalahan, coba lagi.";
    redirect(`/admin/categories?error=${encodeURIComponent(msg)}`);
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
  const result = nameSchema.safeParse(fd.get("name"));
  if (!result.success) {
    redirect(`/admin/categories?error=${encodeURIComponent(result.error.issues[0].message)}`);
  }
  try {
    await createTag(result.data);
  } catch (e) {
    const isUniqueViolation = (e as { code?: string }).code === "23505";
    const msg = isUniqueViolation ? "Tag sudah ada." : "Terjadi kesalahan, coba lagi.";
    redirect(`/admin/categories?error=${encodeURIComponent(msg)}`);
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
