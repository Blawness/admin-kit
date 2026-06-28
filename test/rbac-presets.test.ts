import { describe, it, expect } from "vitest";
import { presets } from "../src/rbac/presets.ts";

describe("presets", () => {
  it("adminEditor gives admin full access", () => {
    expect(presets.adminEditor.admin).toEqual(["*"]);
  });
  it("adminEditor editor cannot manage users", () => {
    expect(presets.adminEditor.editor).not.toContain("users.delete");
    expect(presets.adminEditor.editor.every((p) => !p.startsWith("users."))).toBe(true);
    expect(presets.adminEditor.editor.some((p) => p.startsWith("articles"))).toBe(true);
  });
  it("fourTier has four roles", () => {
    expect(Object.keys(presets.fourTier).sort()).toEqual(["admin", "author", "editor", "viewer"]);
  });
  it("fourTier viewer is read-only", () => {
    expect(presets.fourTier.viewer.every((p) => p.endsWith(".read"))).toBe(true);
  });
  it("named permission bundles exist", () => {
    expect(presets.permissions.articleAuthor).toContain("articles.create");
    expect(presets.permissions.mediaManager).toContain("media.delete");
  });
});
