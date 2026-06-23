import { db } from "../../db/index";
import { media } from "../../db/schema";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { escapeLike } from "../sql-utils";

export type MediaFilters = {
  q?: string;
  album?: string;
};

function mediaConditions(filters?: MediaFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters?.q && filters.q.trim()) {
    const term = `%${escapeLike(filters.q.trim())}%`;
    const match = or(
      ilike(media.url, term),
      ilike(media.altText, term) as SQL<unknown>,
    );
    if (match) conditions.push(match);
  }
  if (filters?.album) {
    conditions.push(eq(media.album, filters.album));
  }
  return conditions;
}

export async function listMedia(opts?: MediaFilters & { limit?: number; offset?: number }) {
  const conditions = mediaConditions(opts);
  const query = db
    .select()
    .from(media)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(desc(media.uploadedAt))
    .$dynamic();
  if (opts?.limit !== undefined) query.limit(opts.limit);
  if (opts?.offset !== undefined) query.offset(opts.offset);
  return query;
}

/** Total media rows — for pagination controls. */
export async function countMedia(filters?: MediaFilters): Promise<number> {
  const conditions = mediaConditions(filters);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(media)
    .where(conditions.length === 0 ? undefined : and(...conditions));
  return row?.count ?? 0;
}

export async function getMediaById(id: number) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ?? null;
}

export async function deleteMediaRow(id: number) {
  await db.delete(media).where(eq(media.id, id));
}
