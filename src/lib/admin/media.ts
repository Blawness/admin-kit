import { db } from "../../db/index";
import { media } from "../../db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function listMedia(opts?: { limit?: number; offset?: number }) {
  const query = db
    .select()
    .from(media)
    .orderBy(desc(media.uploadedAt))
    .$dynamic();
  if (opts?.limit !== undefined) query.limit(opts.limit);
  if (opts?.offset !== undefined) query.offset(opts.offset);
  return query;
}

/** Total media rows — for pagination controls. */
export async function countMedia(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(media);
  return row?.count ?? 0;
}

export async function getMediaById(id: number) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ?? null;
}

export async function deleteMediaRow(id: number) {
  await db.delete(media).where(eq(media.id, id));
}
