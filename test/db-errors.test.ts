import { describe, it, expect } from "vitest";
import { isUniqueViolation, isForeignKeyViolation } from "../src/lib/db-errors.ts";

describe("isUniqueViolation", () => {
  it("is true for code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("is false for other codes", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation({ code: "00000" })).toBe(false);
  });

  it("is false for null/undefined/non-objects", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(42)).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
  });
});

describe("isForeignKeyViolation", () => {
  it("is true for code 23503", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
  });

  it("is false for other codes", () => {
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(isForeignKeyViolation({ code: "00000" })).toBe(false);
  });

  it("is false for null/undefined/non-objects", () => {
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation(undefined)).toBe(false);
    expect(isForeignKeyViolation("23503")).toBe(false);
    expect(isForeignKeyViolation(42)).toBe(false);
    expect(isForeignKeyViolation({})).toBe(false);
  });
});
