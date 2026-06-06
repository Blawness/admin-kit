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
  } catch {
    redirect(`/admin/categories?error=${encodeURIComponent("Kategori sudah ada.")}`);
  }
  redirect("/admin/categories");
}

export async function deleteCategoryAction(fd: FormData) {
  await requireAdmin();
  await deleteCategory(Number(fd.get("id")));
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
  } catch {
    redirect(`/admin/categories?error=${encodeURIComponent("Tag sudah ada.")}`);
  }
  redirect("/admin/categories");
}

export async function deleteTagAction(fd: FormData) {
  await requireAdmin();
  await deleteTag(Number(fd.get("id")));
  redirect("/admin/categories");
}
