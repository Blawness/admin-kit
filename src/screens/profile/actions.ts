"use server";

import { redirect } from "next/navigation";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "../../lib/auth-helpers";
import { db } from "../../db/index";
import { users } from "../../db/schema";
import { updateUserName, updateUserPassword } from "../../lib/admin/users";
import { logAudit } from "../../lib/audit";

const nameSchema = z.string().min(1, "Nama tidak boleh kosong").max(100);

const passwordSchema = z.object({
  current: z.string().min(1, "Password saat ini wajib diisi"),
  new: z.string().min(8, "Password baru minimal 8 karakter"),
});

export async function updateProfileAction(fd: FormData) {
  const session = await requireUser();
  const name = String(fd.get("name") ?? "");
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    redirect(
      `/admin/profile?error=${encodeURIComponent(parsed.error.issues[0].message)}&name=${encodeURIComponent(name)}`,
    );
  }
  await updateUserName(Number(session.user.id), parsed.data);
  redirect("/admin/profile?ok=1");
}

export async function changePasswordAction(fd: FormData) {
  const session = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: fd.get("current"),
    new: fd.get("new"),
  });
  if (!parsed.success) {
    redirect(
      `/admin/profile?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }
  const { current, new: newPassword } = parsed.data;

  const [userRow] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .limit(1);

  if (!userRow?.passwordHash) {
    redirect(
      "/admin/profile?error=" +
        encodeURIComponent("Akun ini tidak memiliki password (mungkin login via OAuth)."),
    );
  }

  const ok = await compare(current, userRow.passwordHash);
  if (!ok) {
    redirect(
      "/admin/profile?error=" +
        encodeURIComponent("Password saat ini salah."),
    );
  }

  await updateUserPassword(Number(session.user.id), newPassword);
  logAudit({
    actorId: Number(session.user.id),
    action: "user.reset_password",
    entityType: "user",
    entityId: Number(session.user.id),
  }).catch(() => {});
  redirect("/admin/profile?ok=1");
}
