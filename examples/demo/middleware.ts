import NextAuth from "next-auth";
import { rbac } from "./rbac";

export const { auth: middleware } = NextAuth(rbac.authConfig);

export const config = {
  matcher: ["/admin/:path*"],
};
