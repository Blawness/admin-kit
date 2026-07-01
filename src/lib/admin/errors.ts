/** Thrown when a caller is authenticated but not the owner (and lacks a
 * manageAny-style override) of the row they're trying to mutate. Distinct
 * from plain `Error` so callers can log/handle ownership denials specifically
 * (e.g. audit logging) without string-matching messages. */
export class OwnershipError extends Error {}
