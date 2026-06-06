import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [], // real provider added in auth/index.ts (Node runtime)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAdminArea = nextUrl.pathname.startsWith("/admin");
      const isLogin = nextUrl.pathname === "/admin/login";
      // Already-authenticated users have no business on the login page.
      if (isLogin) {
        return auth?.user
          ? Response.redirect(new URL("/admin", nextUrl))
          : true;
      }
      if (isAdminArea) return !!auth?.user;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user.role as string | undefined) ?? "editor";
      }
      return token;
    },
    session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = session.user as any;
      if (token.id) u.id = token.id;
      u.role = token.role ?? "editor";
      return session;
    },
  },
};
