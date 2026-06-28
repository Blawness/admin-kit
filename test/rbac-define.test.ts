import { describe, it, expect } from "vitest";
import { defineRbac } from "../src/rbac/define-rbac.ts";
import { presets } from "../src/rbac/presets.ts";
import { getActiveRbac } from "../src/rbac/registry.ts";

describe("defineRbac", () => {
  it("registers the active runtime", () => {
    defineRbac({ roles: { admin: ["*"] }, fallbackRole: "admin", protectedPermission: "users.delete" });
    expect(getActiveRbac().config.fallbackRole).toBe("admin");
  });
  it("throws when fallbackRole is not a defined role", () => {
    expect(() =>
      defineRbac({ roles: { admin: ["*"] }, fallbackRole: "ghost", protectedPermission: "users.delete" }),
    ).toThrow(/fallbackRole/);
  });
  it("can() resolves through the bundle", () => {
    const rbac = defineRbac({
      roles: { ...presets.adminEditor },
      fallbackRole: "editor",
      protectedPermission: "users.delete",
    });
    expect(rbac.can("admin", "users.delete")).toBe(true);
    expect(rbac.can("editor", "users.delete")).toBe(false);
  });
  it("filterNav drops items the role cannot access", () => {
    const rbac = defineRbac({
      roles: { admin: ["*"], editor: ["articles.read"] },
      fallbackRole: "editor",
      protectedPermission: "users.delete",
    });
    const nav = [
      { label: "Articles", href: "/a", requires: "articles.read" },
      { label: "Users", href: "/u", requires: "users.read" },
      { label: "Home", href: "/" },
    ];
    const out = rbac.filterNav(nav as any, "editor");
    expect(out.map((i) => i.label)).toEqual(["Articles", "Home"]);
  });
  it("filterNav recurses into children and drops empty groups", () => {
    const rbac = defineRbac({
      roles: { admin: ["*"], editor: ["articles.read"] },
      fallbackRole: "editor",
      protectedPermission: "users.delete",
    });
    const nav = [
      { label: "Manage", children: [{ label: "Users", href: "/u", requires: "users.read" }] },
    ];
    expect(rbac.filterNav(nav as any, "editor")).toEqual([]);
  });
  it("exposes the produced authConfig", () => {
    const rbac = defineRbac({ roles: { admin: ["*"] }, fallbackRole: "admin", protectedPermission: "users.delete" });
    expect(rbac.authConfig.callbacks?.jwt).toBeTypeOf("function");
  });
});
