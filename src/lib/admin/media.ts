import { db } from "../../db/index";
import { media } from "../../db/schema";
import { desc, eq } from "drizzle-orm";

export async function listMedia() {
  return db.select().from(media).orderBy(desc(media.uploadedAt));
}

export async function getMediaById(id: number) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ?? null;
}

export async function deleteMediaRow(id: number) {
  await db.delete(media).where(eq(media.id, id));
}
