/**
 * Escape LIKE/ILIKE wildcards (`%`, `_`) and the escape char (`\`) so that
 * user-supplied search input is matched literally instead of as a pattern.
 * Postgres uses backslash as the default LIKE escape character.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
