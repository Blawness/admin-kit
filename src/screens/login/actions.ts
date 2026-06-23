"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { signIn } from "../../auth/index";
import { db } from "../../db/index";
import { users } from "../../db/schema";
import {
  isRateLimited,
  recordLoginAttempt,
  clearRateLimit,
} from "../../lib/rate-limit";
import { logAudit } from "../../lib/audit";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();

  // Rate-limit: block before any DB credential check
  if (email && (await isRateLimited(email))) {
    return {
      error:
        "Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.",
    };
  }

  try {
    const result = await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });

    // Robust failure detection across next-auth v5 beta versions:
    // treat any "error" indicator (case-insensitive) or a null/undefined
    // result as a failure. Only redirect when signIn clearly succeeded.
    const failed =
      result == null ||
      (typeof result === "string" && result.toLowerCase().includes("error"));
    if (failed) {
      if (email) await recordLoginAttempt(email);
      return { error: "Email atau password salah." };
    }

    // Successful login — clear any previous failed attempts & audit
    if (email) {
      await clearRateLimit(email);
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (userRow) {
        logAudit({
          actorId: userRow.id,
          action: "auth.login",
          entityType: "auth",
        }).catch(() => {});
      }
    }
    redirect("/admin");
  } catch (error) {
    // Catch CredentialsSignin and other auth errors thrown by next-auth
    // NEXT_REDIRECT thrown by redirect() must propagate
    if (
      error instanceof Error &&
      "digest" in error &&
      String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    if (email) await recordLoginAttempt(email);
    return { error: "Email atau password salah." };
  }
}
