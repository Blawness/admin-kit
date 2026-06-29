import NextAuth, { type NextAuthResult } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";
import { authConfig } from "./config";
import { isRateLimited } from "../lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const _result: NextAuthResult = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Rate-limit check: skip expensive bcrypt for blocked identifiers
        if (await isRateLimited(email)) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          // Pass the raw role through; the jwt callback resolves a missing
          // role via the configured fallbackRole (single source of truth).
          role: user.role,
        };
      },
    }),
  ],
});

export const handlers: NextAuthResult["handlers"] = _result.handlers;
export const auth: NextAuthResult["auth"] = _result.auth;
export const signIn: NextAuthResult["signIn"] = _result.signIn;
export const signOut: NextAuthResult["signOut"] = _result.signOut;
