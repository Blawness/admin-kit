"use server";
import { signOut } from "../auth/index";

export async function signOutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
