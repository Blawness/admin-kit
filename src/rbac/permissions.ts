/** All permissions the package's own built-in screens check. */
export type BuiltInPermission =
  | "users.read" | "users.create" | "users.update" | "users.delete"
  | "media.read" | "media.upload" | "media.delete"
  | "media.manageAny"
  | "articles.read" | "articles.create" | "articles.update" | "articles.delete" | "articles.publish"
  | "articles.manageAny"
  | "categories.read" | "categories.create" | "categories.update" | "categories.delete"
  | "profile.edit";

/**
 * A permission string of the form `resource.action`. Built-ins get
 * autocomplete; the `(string & {})` arm keeps arbitrary consumer strings
 * (e.g. "reports.export") assignable without widening to plain `string`.
 */
export type Permission = BuiltInPermission | (string & {});

/** True if a single granted entry covers `perm` (exact, `resource.*`, or `*`). */
export function matches(granted: string, perm: string): boolean {
  if (granted === "*" || granted === perm) return true;
  const dot = perm.indexOf(".");
  if (dot === -1) return false;
  const resource = perm.slice(0, dot);
  return granted === `${resource}.*`;
}

/** True if any of the granted entries covers `perm`. */
export function hasPermission(granted: readonly string[], perm: string): boolean {
  return granted.some((g) => matches(g, perm));
}
