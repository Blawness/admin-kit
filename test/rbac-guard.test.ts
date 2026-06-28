import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

vi.mock("../src/auth/index.ts", () => ({ auth: authMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { requirePermission } from "../src/lib/auth-helpers.ts";
import { buildRuntime, setActiveRbac } from "../src/rbac/registry.ts";

beforeEach(() => {
  authMock.mockReset();
  redirectMock.mockClear();
  setActiveRbac(buildRuntime({
    roles: { admin: ["*"], editor: ["articles.read"] },
    fallbackRole: "editor",
    protectedPermission: "users.delete",
  }));
});

describe("requirePermission", () => {
  it("returns session when the role grants the permission", async () => {
    authMock.mockResolvedValue({ user: { id: "1", role: "admin" } });
    const session = await requirePermission("users.delete");
    expect(session.user.role).toBe("admin");
    expect(redirectMock).not.toHaveBeenCalled();
  });
  it("redirects to /admin/login when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    await expect(requirePermission("articles.read")).rejects.toThrow("REDIRECT:/admin/login");
  });
  it("redirects to /admin when authenticated but lacking permission", async () => {
    authMock.mockResolvedValue({ user: { id: "2", role: "editor" } });
    await expect(requirePermission("users.delete")).rejects.toThrow("REDIRECT:/admin");
  });
});
