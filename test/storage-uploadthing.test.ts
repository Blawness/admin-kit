// test/storage-uploadthing.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadFiles = vi.fn();
const deleteFiles = vi.fn();
vi.mock("uploadthing/server", () => ({
  // Harus pakai function biasa (bukan arrow function) agar bisa dipanggil dengan `new`.
  UTApi: vi.fn(function () { return { uploadFiles, deleteFiles }; }),
}));

beforeEach(() => {
  uploadFiles.mockReset();
  deleteFiles.mockReset();
});

describe("uploadThingProvider.put", () => {
  it("uploads the buffer and maps ufsUrl + key", async () => {
    uploadFiles.mockResolvedValue({ data: { key: "abc123", ufsUrl: "https://app.ufs.sh/f/abc123" }, error: null });
    const { uploadThingProvider } = await import("../src/lib/storage/uploadthing");
    const res = await uploadThingProvider.put(
      { body: Buffer.from("imgbytes"), ext: "webp", contentType: "image/webp" },
      "uploads/xyz",
    );
    expect(res).toEqual({ url: "https://app.ufs.sh/f/abc123", key: "abc123", size: 8 });
    expect(uploadFiles).toHaveBeenCalledOnce();
  });

  it("throws when UTApi returns an error", async () => {
    uploadFiles.mockResolvedValue({ data: null, error: { message: "nope" } });
    const { uploadThingProvider } = await import("../src/lib/storage/uploadthing");
    await expect(
      uploadThingProvider.put({ body: Buffer.from("x"), ext: "jpg", contentType: "image/jpeg" }, "uploads/a"),
    ).rejects.toThrow(/admin-kit/);
  });
});

describe("uploadThingProvider.deleteByUrl", () => {
  it("extracts the key and deletes", async () => {
    deleteFiles.mockResolvedValue({ success: true });
    const { uploadThingProvider } = await import("../src/lib/storage/uploadthing");
    const ok = await uploadThingProvider.deleteByUrl("https://app.ufs.sh/f/abc123");
    expect(ok).toBe(true);
    expect(deleteFiles).toHaveBeenCalledWith(["abc123"]);
  });

  it("ignores non-uploadthing urls", async () => {
    const { uploadThingProvider } = await import("../src/lib/storage/uploadthing");
    const ok = await uploadThingProvider.deleteByUrl("https://cdn.example.com/uploads/abc.webp");
    expect(ok).toBe(false);
    expect(deleteFiles).not.toHaveBeenCalled();
  });
});
