"use server";

import { redirect } from "next/navigation";
import { signIn } from "../../auth/index";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    const result = await signIn("credentials", {
      email: formData.get("email"),
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
      return { error: "Email atau password salah." };
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
    return { error: "Email atau password salah." };
  }
}
