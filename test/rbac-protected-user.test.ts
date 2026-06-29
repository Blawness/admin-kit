import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildRuntime, setActiveRbac } from "../src/rbac/registry.ts";

// ---------------------------------------------------------------------------
// Mock the db layer before importing users.ts so drizzle never tries to
// connect.  We intercept db.transaction and hand the callback a fake tx
// whose select() chain returns values we control per-test.
// ---------------------------------------------------------------------------
const { mockTransaction } = vi.hoisted(() => ({ mockTransaction: vi.fn() }));

vi.mock("../src/db/index.ts", () => ({
  db: { transaction: mockTransaction },
}));

// bcryptjs is a node-only dep; mock it so vitest (which may run under jsdom
// or a stripped env) does not error on import.
vi.mock("bcryptjs", () => ({ hash: vi.fn(async (p: string) => `hashed:${p}`) }));

import { rolesGranting, deleteUser, updateUserRole, LastAdminError } from "../src/lib/admin/users.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Build a fake drizzle-style transaction whose two sequential select() calls
 *  return `targetRow` first and `{ count }` second, then silently absorb any
 *  delete/update. */
function makeTx(targetRole: string | null, holderCount: number) {
  let selectCall = 0;
  const chainEnd = vi.fn().mockResolvedValue(undefined);
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => {
          selectCall += 1;
          if (selectCall === 1) {
            // First select: fetch the target user row.
            return targetRole === null ? [] : [{ role: targetRole }];
          }
          // Second select: count of users with protectedPermission.
          return [{ count: holderCount }];
        }),
      })),
    })),
    delete: vi.fn(() => ({ where: chainEnd })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: chainEnd })) })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setActiveRbac(buildRuntime({
    roles: {
      superadmin: ["*"],
      manager: ["users.delete", "users.read"],
      author: ["articles.read"],
    },
    fallbackRole: "author",
    protectedPermission: "users.delete",
  }));
});

// ---------------------------------------------------------------------------
// rolesGranting (existing pure-helper tests, kept here for co-location)
// ---------------------------------------------------------------------------
describe("rolesGranting", () => {
  it("returns every role whose permissions cover the permission", () => {
    expect(rolesGranting("users.delete").sort()).toEqual(["manager", "superadmin"]);
  });
  it("returns only wildcard roles for an unlisted permission", () => {
    expect(rolesGranting("reports.export")).toEqual(["superadmin"]);
  });
});

// ---------------------------------------------------------------------------
// deleteUser — behavioral guard tests
// ---------------------------------------------------------------------------
describe("deleteUser", () => {
  it("throws LastAdminError when target is the last holder of protectedPermission", async () => {
    // The target user holds 'superadmin' (wildcard → has users.delete).
    // Only 1 user has users.delete → deleting them would lock everyone out.
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeTx("superadmin", 1)),
    );
    await expect(deleteUser(1)).rejects.toBeInstanceOf(LastAdminError);
  });

  it("does NOT throw when another holder of protectedPermission still exists", async () => {
    // 2 users have users.delete → safe to delete this one.
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeTx("superadmin", 2)),
    );
    await expect(deleteUser(1)).resolves.toBeUndefined();
  });

  it("does NOT throw when the target lacks protectedPermission", async () => {
    // target is 'author' which only has articles.read → no guard needed.
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeTx("author", 1)),
    );
    await expect(deleteUser(1)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// updateUserRole — behavioral guard tests
// ---------------------------------------------------------------------------
describe("updateUserRole", () => {
  it("throws LastAdminError when demoting the last holder of protectedPermission", async () => {
    // target currently holds 'manager' (has users.delete), being demoted to 'author'.
    // Only 1 user has users.delete → demotion would cause lockout.
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeTx("manager", 1)),
    );
    await expect(updateUserRole(1, "author")).rejects.toBeInstanceOf(LastAdminError);
  });

  it("does NOT throw when another holder of protectedPermission still exists", async () => {
    // 2 users have users.delete → safe to demote this one.
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeTx("manager", 2)),
    );
    await expect(updateUserRole(1, "author")).resolves.toBeUndefined();
  });

  it("does NOT throw when promoting (new role also has protectedPermission)", async () => {
    // author → superadmin: no demotion of protection, guard is irrelevant.
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeTx("author", 0)),
    );
    await expect(updateUserRole(1, "superadmin")).resolves.toBeUndefined();
  });

  it("does NOT throw when target role already lacked protectedPermission", async () => {
    // author → author: no change, no guard.
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(makeTx("author", 0)),
    );
    await expect(updateUserRole(1, "author")).resolves.toBeUndefined();
  });
});
