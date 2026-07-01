import { describe, it, expect } from "vitest";
import { presets } from "../src/rbac/presets.ts";

describe("presets", () => {
  it("adminEditor gives admin full access", () => {
    expect(presets.adminEditor.admin).toEqual(["*"]);
  });
  it("adminEditor editor has legacy editor scope (read/create/update articles, read/upload media, profile.edit)", () => {
    expect(presets.adminEditor.editor).toContain("articles.create");
    expect(presets.adminEditor.editor).toContain("articles.update");
    expect(presets.adminEditor.editor).toContain("media.read");
    expect(presets.adminEditor.editor).toContain("media.upload");
    expect(presets.adminEditor.editor).toContain("profile.edit");
  });
  it("adminEditor editor does NOT grant escalated privileges (publish, delete, category mutations)", () => {
    expect(presets.adminEditor.editor).not.toContain("articles.delete");
    expect(presets.adminEditor.editor).not.toContain("articles.publish");
    expect(presets.adminEditor.editor).not.toContain("categories.delete");
    expect(presets.adminEditor.editor).not.toContain("categories.create");
    expect(presets.adminEditor.editor).not.toContain("media.delete");
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
  it("articles.manageAny is granted to contentEditor but not articleAuthor, legacyEditor (adminEditor.editor), or fourTier.viewer", () => {
    expect(presets.permissions.contentEditor).toContain("articles.manageAny");
    expect(presets.permissions.articleAuthor).not.toContain("articles.manageAny");
    expect(presets.adminEditor.editor).not.toContain("articles.manageAny");
    expect(presets.fourTier.viewer).not.toContain("articles.manageAny");
  });
  it("media.manageAny is granted to contentEditor and mediaManager but not articleAuthor, legacyEditor (adminEditor.editor), or fourTier.viewer", () => {
    expect(presets.permissions.contentEditor).toContain("media.manageAny");
    expect(presets.permissions.mediaManager).toContain("media.manageAny");
    expect(presets.permissions.articleAuthor).not.toContain("media.manageAny");
    expect(presets.adminEditor.editor).not.toContain("media.manageAny");
    expect(presets.fourTier.viewer).not.toContain("media.manageAny");
  });
});
