// Shared upload constraints used by both the client (pre-validation) and the
// server action (authoritative validation). No "use client"/"use server"
// directive so it is safely importable from both sides.
export const OK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
