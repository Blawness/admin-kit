import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockDelete, mockUpdate, deleteObjectByUrlMock } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
  deleteObjectByUrlMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("../src/db/index.ts", () => ({
  db: { select: mockSelect, delete: mockDelete, update: mockUpdate },
}));

vi.mock("../src/lib/r2.ts", () => ({ deleteObjectByUrl: deleteObjectByUrlMock }));

import { deleteArticle } from "../src/lib/admin/articles.ts";

/** Make db.select(...).from(...).where(...) resolve to `rows`. */
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
  mockUpdate.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) });
  deleteObjectByUrlMock.mockResolvedValue(true);
});

describe("deleteArticle", () => {
  it("throws when the article does not exist", async () => {
    selectReturning([]);
    await expect(deleteArticle(1, { userId: 1, isAdmin: false })).rejects.toThrow(
      "Artikel tidak ditemukan.",
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows the owner to delete their own article", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    await expect(deleteArticle(5, { userId: 7, isAdmin: false })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("rejects a non-owner without manageAny", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    await expect(deleteArticle(5, { userId: 9, isAdmin: false })).rejects.toThrow(
      "Tidak diizinkan menghapus artikel ini.",
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("allows a non-owner with isAdmin (manageAny) to delete any article", async () => {
    selectReturning([{ coverImageUrl: null, authorId: 7 }]);
    await expect(deleteArticle(5, { userId: 9, isAdmin: true })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it("deletes the R2 cover image after removing the row", async () => {
    selectReturning([{ coverImageUrl: "https://cdn.example.com/x.jpg", authorId: 7 }]);
    await deleteArticle(5, { userId: 7, isAdmin: false });
    expect(deleteObjectByUrlMock).toHaveBeenCalledWith("https://cdn.example.com/x.jpg");
  });
});
