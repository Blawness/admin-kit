import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { categories, tags } from "../../db/schema";
import { slugify } from "../slug";

export async function listCategories() {
  return db.select().from(categories).orderBy(categories.name);
}

export async function createCategory(name: string) {
  const [row] = await db
    .insert(categories)
    .values({ name, slug: slugify(name) })
    .returning({ id: categories.id });
  return row;
}

export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id));
}

export async function listTags() {
  return db.select().from(tags).orderBy(tags.name);
}

export async function createTag(name: string) {
  const [row] = await db
    .insert(tags)
    .values({ name, slug: slugify(name) })
    .returning({ id: tags.id });
  return row;
}

export async function deleteTag(id: number) {
  await db.delete(tags).where(eq(tags.id, id));
}
