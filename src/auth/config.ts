import type { NextAuthConfig } from "next-auth";
import { peekActiveRbac } from "../rbac/registry";

/**
 * Build the edge-safe NextAuth config. `fallbackRole` is the role assigned to
 * tokens/sessions that carry no role. The active RBAC runtime (once registered)
 * takes precedence so the consumer's fallbackRole wins even on the node path.
 */
export function buildAuthConfig(fallbackRole: string): NextAuthConfig {
  const resolveFallback = () => peekActiveRbac()?.config.fallbackRole ?? fallbackRole;
  return {
    pages: { signIn: "/admin/login" },
    session: { strategy: "jwt" },
    trustHost: true,
    providers: [], // real provider added in auth/index.ts (Node runtime)
    callbacks: {
      authorized({ auth, request: { nextUrl } }) {
        const isAdminArea = nextUrl.pathname.startsWith("/admin");
        const isLogin = nextUrl.pathname === "/admin/login";
        if (isLogin) {
          return auth?.user ? Response.redirect(new URL("/admin", nextUrl)) : true;
        }
        if (isAdminArea) return !!auth?.user;
        return true;
      },
      jwt({ token, user }) {
        if (user) {
          token.id = user.id as string;
          token.role = (user.role as string | undefined) ?? resolveFallback();
        }
        return token;
      },
      session({ session, token }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any;
        if (token.id) u.id = token.id;
        u.role = token.role ?? resolveFallback();
        return session;
      },
    },
  };
}

/** Default config used by the package's own auth/index.ts. */
export const authConfig: NextAuthConfig = buildAuthConfig("editor");
