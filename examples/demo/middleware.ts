import NextAuth from "next-auth";
import { authConfig } from "@blawness/admin-kit/auth/config";

// Edge-safe auth check (no DB/bcrypt) — protects /admin/* and bounces
// already-authenticated users away from /admin/login.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*"],
};
