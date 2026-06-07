export { cn } from "./lib/utils";
export { slugify } from "./lib/slug";
export { sanitizeHtml } from "./lib/sanitize";
export * from "./lib/db-errors";
export * from "./lib/r2";
export * from "./db/schema";
export { db } from "./db/index";

/**
 * Concrete, importable shape of the authenticated admin session user.
 * The ambient `next-auth` module augmentation in src/types/next-auth.d.ts is
 * used for the package's own build, but ambient augmentations do not reliably
 * cross the package boundary into consumers. Consumers can use this type to
 * explicitly type `session.user` (e.g. `session.user as AdminSessionUser`).
 */
export type AdminSessionUser = {
  id: string;
  role: string;
  email?: string | null;
  name?: string | null;
};
