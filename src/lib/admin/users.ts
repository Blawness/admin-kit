import { db } from "../../db/index";
import { users } from "../../db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { hash } from "bcryptjs";

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

// Jumlah admin di dalam transaksi berjalan — dipakai untuk guard lockout.
async function countAdmins(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  return row?.count ?? 0;
}

export async function listUsers() {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .orderBy(asc(users.email));
}

export type UserRole = "admin" | "editor";

export async function createUser(email: string, name: string, password: string, role: UserRole) {
  const passwordHash = await hash(password, 12);
  const [row] = await db.insert(users).values({ email, name, passwordHash, role }).returning({ id: users.id });
  return row;
}

export async function updateUserPassword(id: number, password: string) {
  const passwordHash = await hash(password, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function updateUserRole(id: number, role: UserRole) {
  await db.transaction(async (tx) => {
    // Menurunkan admin → editor: tolak bila ini admin terakhir.
    if (role === "editor") {
      const [target] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, id));
      if (target?.role === "admin" && (await countAdmins(tx)) <= 1) {
        throw new LastAdminError();
      }
    }
    await tx.update(users).set({ role }).where(eq(users.id, id));
  });
}

export async function deleteUser(id: number) {
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, id));
    if (!target) return;
    // Menghapus admin terakhir akan mengunci seluruh akses admin.
    if (target.role === "admin" && (await countAdmins(tx)) <= 1) {
      throw new LastAdminError();
    }
    await tx.delete(users).where(eq(users.id, id));
  });
}
