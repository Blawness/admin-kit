import { db } from "../../db/index";
import { users } from "../../db/schema";
import { asc, eq } from "drizzle-orm";
import { hash } from "bcryptjs";

export async function listUsers() {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .orderBy(asc(users.email));
}

export type UserRole = "admin" | "editor";

export async function createUser(email: string, name: string, password: string, role: UserRole) {
  const passwordHash = await hash(password, 12);
  await db.insert(users).values({ email, name, passwordHash, role });
}

export async function updateUserPassword(id: number, password: string) {
  const passwordHash = await hash(password, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function updateUserRole(id: number, role: UserRole) {
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  await db.delete(users).where(eq(users.id, id));
}
