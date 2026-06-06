function hasSqlState(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}

/** True when a Postgres error is a unique-constraint violation (SQLSTATE 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return hasSqlState(error, "23505");
}

/** True when a Postgres error is a foreign-key violation (SQLSTATE 23503). */
export function isForeignKeyViolation(error: unknown): boolean {
  return hasSqlState(error, "23503");
}
