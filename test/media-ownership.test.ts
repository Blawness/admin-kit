import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("../src/db/index.ts", () => ({
  db: { select: mockSelect, delete: mockDelete },
}));

import { deleteMediaRow } from "../src/lib/admin/media.ts";
import { OwnershipError } from "../src/lib/admin/errors.ts";

function selectReturning(rows: unknown[]) {
  mockSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(rows),
    })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
});

describe("deleteMediaRow", () => {
  it("throws when the media row does not exist", async () => {
    selectReturning([]);
    await expect(deleteMediaRow(1, { userId: 1, isAdmin: false })).rejects.toThrow(
      "Media tidak ditemukan.",
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows the uploader to delete their own media", async () => {
    selectReturning([{ uploadedBy: 7 }]);
    await expect(deleteMediaRow(5, { userId: 7, isAdmin: false })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("rejects a non-uploader without manageAny with OwnershipError", async () => {
    selectReturning([{ uploadedBy: 7 }]);
    await expect(deleteMediaRow(5, { userId: 9, isAdmin: false })).rejects.toBeInstanceOf(
      OwnershipError,
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows a non-uploader with isAdmin (manageAny) to delete any media", async () => {
    selectReturning([{ uploadedBy: 7 }]);
    await expect(deleteMediaRow(5, { userId: 9, isAdmin: true })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("rejects deleting an unowned (uploadedBy: null) row without manageAny", async () => {
    selectReturning([{ uploadedBy: null }]);
    await expect(deleteMediaRow(5, { userId: 9, isAdmin: false })).rejects.toBeInstanceOf(
      OwnershipError,
    );
  });

  it("allows manageAny to delete an unowned (uploadedBy: null) row", async () => {
    selectReturning([{ uploadedBy: null }]);
    await expect(deleteMediaRow(5, { userId: 9, isAdmin: true })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });
});
