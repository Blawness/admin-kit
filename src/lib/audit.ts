import { desc, eq } from "drizzle-orm"
import { db } from "../db/index"
import { auditLogs, users } from "../db/schema"

export type AuditAction =
  | "auth.login"
  | "auth.login_blocked"
  | "user.create"
  | "user.delete"
  | "user.set_role"
  | "user.reset_password"
  | "article.create"
  | "article.update"
  | "article.delete"
  | "article.submit"
  | "article.publish"
  | "article.reject"
  | "article.access_denied"
  | "category.create"
  | "category.delete"
  | "tag.create"
  | "tag.delete"
  | "media.upload"
  | "media.delete"
  | "media.access_denied"

type LogAuditParams = {
  actorId: number
  action: AuditAction
  entityType: string
  entityId?: number
  summary?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    summary: params.summary,
    metadata: params.metadata,
  })
}

export type AuditLogEntry = Awaited<ReturnType<typeof listAuditLogs>>[number]

export async function listAuditLogs(opts?: { limit?: number; offset?: number }) {
  const query = db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      actorEmail: users.email,
      actorName: users.name,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      summary: auditLogs.summary,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .$dynamic()

  if (opts?.limit !== undefined) query.limit(opts.limit)
  if (opts?.offset !== undefined) query.offset(opts.offset)

  return query
}
