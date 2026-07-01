import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermissionMock, canMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  canMock: vi.fn(),
}));

vi.mock("../src/lib/auth-helpers.ts", () => ({
  requirePermission: requirePermissionMock,
  requireUser: vi.fn(),
}));

vi.mock("../src/rbac/registry.ts", () => ({
  getActiveRbac: () => ({ can: canMock }),
}));

const { mockInsert, mockSelect } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("../src/db/index.ts", () => ({
  db: { insert: mockInsert, select: mockSelect },
}));

vi.mock("../src/lib/storage/index.ts", () => ({
  uploadImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/a.jpg" }),
  uploadFile: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/a.jpg" }),
}));

vi.mock("../src/lib/audit.ts", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { uploadImageAction } from "../src/screens/media/actions.ts";

beforeEach(() => {
  vi.clearAllMocks();
  requirePermissionMock.mockResolvedValue({ user: { id: "5", role: "editor" } });
  mockInsert.mockReturnValue({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    })),
  });
});

describe("uploadImageAction", () => {
  it("requires the media.upload permission, not just any authenticated user", async () => {
    const fd = new FormData();
    fd.set("file", new File(["x"], "a.png", { type: "image/png" }));
    await uploadImageAction(fd);
    expect(requirePermissionMock).toHaveBeenCalledWith("media.upload");
  });

  it("stamps uploadedBy with the session user id on insert", async () => {
    const fd = new FormData();
    fd.set("file", new File(["x"], "a.png", { type: "image/png" }));
    await uploadImageAction(fd);
    const insertCall = mockInsert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertCall.uploadedBy).toBe(5);
  });
});
