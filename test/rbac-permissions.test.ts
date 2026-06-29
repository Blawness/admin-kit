import { describe, it, expect } from "vitest";
import { matches, hasPermission } from "../src/rbac/permissions.ts";

describe("matches", () => {
  it("matches exact permission", () => {
    expect(matches("articles.delete", "articles.delete")).toBe(true);
  });
  it("matches resource wildcard", () => {
    expect(matches("articles.*", "articles.delete")).toBe(true);
  });
  it("matches global wildcard", () => {
    expect(matches("*", "users.create")).toBe(true);
  });
  it("does not match different resource wildcard", () => {
    expect(matches("media.*", "articles.delete")).toBe(false);
  });
  it("does not match different exact", () => {
    expect(matches("articles.read", "articles.delete")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("is true when any granted entry matches", () => {
    expect(hasPermission(["media.read", "articles.*"], "articles.delete")).toBe(true);
  });
  it("is false when nothing matches", () => {
    expect(hasPermission(["media.read"], "articles.delete")).toBe(false);
  });
  it("is false for empty grants", () => {
    expect(hasPermission([], "articles.delete")).toBe(false);
  });
});
