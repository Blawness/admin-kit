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

    // Auth.js returns the redirect URL when redirect:false
    // On failure it returns a URL with ?error= param
    if (typeof result === "string" && result.includes("error=")) {
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
