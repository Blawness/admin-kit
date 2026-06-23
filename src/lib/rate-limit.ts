import { and, gte, count, eq } from "drizzle-orm"
import { db } from "../db/index"
import { loginAttempts } from "../db/schema"

export const MAX_LOGIN_ATTEMPTS = 5
export const LOGIN_WINDOW_MINUTES = 15

function windowStart(): Date {
  return new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000)
}

export async function isRateLimited(identifier: string): Promise<boolean> {
  const since = windowStart()
  const [row] = await db
    .select({ count: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.identifier, identifier),
        gte(loginAttempts.attemptedAt, since),
      ),
    )
  return (row?.count ?? 0) >= MAX_LOGIN_ATTEMPTS
}

export async function recordLoginAttempt(identifier: string): Promise<void> {
  await db.insert(loginAttempts).values({ identifier })
}

export async function clearRateLimit(identifier: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.identifier, identifier))
}
