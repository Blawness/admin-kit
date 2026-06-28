import { db } from "../../db/index";
import { users } from "../../db/schema";
import { asc, eq, sql, inArray } from "drizzle-orm";
import { hash } from "bcryptjs";
import { getActiveRbac } from "../../rbac/registry";
import { hasPermission } from "../../rbac/permissions";

/**
 * Dilempar saat sebuah operasi akan menghapus/menurunkan admin terakhir, yang
 * akan mengunci seluruh akses admin (lockout). Ditangkap di server action untuk
 * memberi pesan error, bukan 500.
 */
export class LastAdminError extends Error {
  constructor() {
    super("Tidak bisa menghapus atau menurunkan admin terakhir.");
    this.name = "LastAdminError";
  }
}

/** True bila error berasal dari guard admin-terakhir. */
export function isLastAdminError(e: unknown): e is LastAdminError {
  return e instanceof LastAdminError;
}

/** Roles whose permission set covers `perm`. Pure; reads the active config. */
export function rolesGranting(perm: string): string[] {
  const { config } = getActiveRbac();
  return Object.keys(config.roles).filter((role) => hasPermission(config.roles[role], perm));
}

// How many users hold `perm` (via their role) inside the running transaction.
async function countUsersWith(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  perm: string,
): Promise<number> {
  const roles = rolesGranting(perm);
  if (roles.length === 0) return 0;
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(inArray(users.role, roles));
  return row?.count ?? 0;
}

export async function listUsers() {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .orderBy(asc(users.email));
}

export type UserRole = string;

export async function createUser(email: string, name: string, password: string, role: UserRole) {
  const passwordHash = await hash(password, 12);
  const [row] = await db.insert(users).values({ email, name, passwordHash, role }).returning({ id: users.id });
  return row;
}

export async function updateUserName(id: number, name: string) {
  await db.update(users).set({ name }).where(eq(users.id, id));
}

export async function updateUserPassword(id: number, password: string) {
  const passwordHash = await hash(password, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function updateUserRole(id: number, role: UserRole) {
  const { config } = getActiveRbac();
  const protectedPerm = config.protectedPermission;
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id));
    const targetHadProtection = target?.role ? hasPermission(config.roles[target.role] ?? [], protectedPerm) : false;
    const newRoleHasProtection = hasPermission(config.roles[role] ?? [], protectedPerm);
    // Removing protection from the last user who has it would cause a lockout.
    if (targetHadProtection && !newRoleHasProtection && (await countUsersWith(tx, protectedPerm)) <= 1) {
      throw new LastAdminError();
    }
    await tx.update(users).set({ role }).where(eq(users.id, id));
  });
}

export async function deleteUser(id: number) {
  const { config } = getActiveRbac();
  const protectedPerm = config.protectedPermission;
  await db.transaction(async (tx) => {
    const [target] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id));
    if (!target) return;
    const hadProtection = target.role ? hasPermission(config.roles[target.role] ?? [], protectedPerm) : false;
    if (hadProtection && (await countUsersWith(tx, protectedPerm)) <= 1) {
      throw new LastAdminError();
    }
    await tx.delete(users).where(eq(users.id, id));
  });
}
