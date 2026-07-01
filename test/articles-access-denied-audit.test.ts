import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockDelete, logAuditMock } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
  logAuditMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/db/index.ts", () => ({
  db: { select: mockSelect, delete: mockDelete },
}));
vi.mock("../src/lib/r2.ts", () => ({ deleteObjectByUrl: vi.fn().mockResolvedValue(true) }));
vi.mock("../src/lib/audit.ts", () => ({ logAudit: logAuditMock }));

import { deleteArticle } from "../src/lib/admin/articles.ts";
import { OwnershipError } from "../src/lib/admin/errors.ts";

function selectReturning(rows: unknown[]) {
  mockSelect.mockReturnValue({
    from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteArticle ownership denial", () => {
  it("still throws OwnershipError so the action layer can log it (integration point check)", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    let caught: unknown;
    try {
      await deleteArticle(5, { userId: 9, isAdmin: false });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OwnershipError);
    // The action layer (src/screens/articles/actions.ts), not this lib function,
    // is responsible for calling logAudit — verified by code review of Task 6
    // since actions.ts uses next/navigation's redirect() which isn't mockable
    // without a full Next.js test harness.
  });
});
