import { describe, it, expect, beforeEach } from "vitest";
import { buildRuntime, setActiveRbac } from "../src/rbac/registry.ts";
import { rolesGranting } from "../src/lib/admin/users.ts";

beforeEach(() => {
  setActiveRbac(buildRuntime({
    roles: { superadmin: ["*"], manager: ["users.delete", "users.read"], author: ["articles.read"] },
    fallbackRole: "author",
    protectedPermission: "users.delete",
  }));
});

describe("rolesGranting", () => {
  it("returns every role whose permissions cover the permission", () => {
    expect(rolesGranting("users.delete").sort()).toEqual(["manager", "superadmin"]);
  });
  it("returns only wildcard roles for an unlisted permission", () => {
    expect(rolesGranting("reports.export")).toEqual(["superadmin"]);
  });
});
