import { describe, it, expect } from "vitest";
import { LastAdminError, isLastAdminError } from "../src/lib/admin/users.ts";

describe("isLastAdminError", () => {
  it("is true for a LastAdminError instance", () => {
    expect(isLastAdminError(new LastAdminError())).toBe(true);
  });

  it("is false for other errors and non-errors", () => {
    expect(isLastAdminError(new Error("boom"))).toBe(false);
    expect(isLastAdminError({ name: "LastAdminError" })).toBe(false);
    expect(isLastAdminError(null)).toBe(false);
    expect(isLastAdminError(undefined)).toBe(false);
    expect(isLastAdminError("LastAdminError")).toBe(false);
  });

  it("carries a user-facing Indonesian message", () => {
    expect(new LastAdminError().message).toMatch(/admin terakhir/i);
  });
});
