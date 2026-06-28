import { describe, it, expect, beforeEach } from "vitest";
import { buildRuntime, setActiveRbac, getActiveRbac, peekActiveRbac } from "../src/rbac/registry.ts";

const config = {
  roles: { admin: ["*"], editor: ["articles.*", "media.read"], viewer: [] },
  fallbackRole: "editor",
  protectedPermission: "users.delete",
};

describe("buildRuntime", () => {
  it("permissionsFor returns the role's list", () => {
    const rt = buildRuntime(config);
    expect(rt.permissionsFor("editor")).toEqual(["articles.*", "media.read"]);
  });
  it("permissionsFor falls back for unknown role", () => {
    const rt = buildRuntime(config);
    expect(rt.permissionsFor("ghost")).toEqual(["articles.*", "media.read"]);
  });
  it("can resolves wildcard", () => {
    const rt = buildRuntime(config);
    expect(rt.can("editor", "articles.delete")).toBe(true);
    expect(rt.can("editor", "users.create")).toBe(false);
    expect(rt.can("admin", "users.create")).toBe(true);
  });
  it("can uses fallback role for null/undefined", () => {
    const rt = buildRuntime(config);
    expect(rt.can(null, "articles.read")).toBe(true);
    expect(rt.can(undefined, "users.delete")).toBe(false);
  });
});

describe("registry holder", () => {
  beforeEach(() => setActiveRbac(buildRuntime(config)));
  it("getActiveRbac returns the set runtime", () => {
    expect(getActiveRbac().config.fallbackRole).toBe("editor");
  });
  it("peekActiveRbac returns runtime when set", () => {
    expect(peekActiveRbac()).not.toBeNull();
  });
});
