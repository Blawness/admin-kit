// test/storage-integration.test.ts
// Menguji lapisan penyambung di storage/index: pemilihan provider lewat env,
// cache singleton, routing skipProcessing, dan delegasi API publik. Provider
// & pemrosesan gambar di-mock agar fokus pada logika dispatch (bukan sharp/R2).
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted: vi.mock di-hoist ke atas berkas, jadi fungsi mock harus dibuat
// dalam blok hoisted ini agar sudah terinisialisasi saat factory mock berjalan.
const { r2Put, r2Del, utPut, utDel } = vi.hoisted(() => ({
  r2Put: vi.fn(),
  r2Del: vi.fn(),
  utPut: vi.fn(),
  utDel: vi.fn(),
}));

vi.mock("../src/lib/storage/r2", () => ({
  r2Provider: { name: "r2", put: r2Put, deleteByUrl: r2Del },
  R2_BUCKET: () => "bucket",
  R2_PUBLIC_URL: () => "https://cdn.example.com",
  r2: () => ({}),
}));

vi.mock("../src/lib/storage/uploadthing", () => ({
  uploadThingProvider: { name: "uploadthing", put: utPut, deleteByUrl: utDel },
}));

vi.mock("../src/lib/storage/process", () => ({
  processImage: vi.fn(async () => ({ body: Buffer.from("processed"), ext: "webp", contentType: "image/webp" })),
  asRawUpload: vi.fn((input: Buffer, contentType: string) => ({ body: input, ext: "", contentType })),
}));

import {
  getActiveProvider,
  uploadFile,
  deleteObjectByUrl,
  _resetProviderForTests,
} from "../src/lib/storage/index";
import { processImage, asRawUpload } from "../src/lib/storage/process";

beforeEach(() => {
  vi.clearAllMocks();
  _resetProviderForTests();
  delete process.env.ADMIN_KIT_STORAGE_PROVIDER;
});

describe("getActiveProvider", () => {
  it("resolves the R2 provider by default", async () => {
    const p = await getActiveProvider();
    expect(p.name).toBe("r2");
  });

  it("resolves the UploadThing provider when env selects it", async () => {
    process.env.ADMIN_KIT_STORAGE_PROVIDER = "uploadthing";
    const p = await getActiveProvider();
    expect(p.name).toBe("uploadthing");
  });

  it("caches the resolved provider (env read once until reset)", async () => {
    const first = await getActiveProvider();
    expect(first.name).toBe("r2");
    // Ubah env tanpa reset: provider lama tetap dipakai (cache).
    process.env.ADMIN_KIT_STORAGE_PROVIDER = "uploadthing";
    const cached = await getActiveProvider();
    expect(cached.name).toBe("r2");
    // Setelah reset, env baru terbaca.
    _resetProviderForTests();
    const fresh = await getActiveProvider();
    expect(fresh.name).toBe("uploadthing");
  });
});

describe("uploadFile dispatch", () => {
  it("processes images and delegates to the active provider's put", async () => {
    r2Put.mockResolvedValue({ url: "u", key: "k", size: 9 });
    const res = await uploadFile(Buffer.from("img"), "berita/slug");
    expect(processImage).toHaveBeenCalledOnce();
    expect(asRawUpload).not.toHaveBeenCalled();
    expect(r2Put).toHaveBeenCalledWith(
      { body: Buffer.from("processed"), ext: "webp", contentType: "image/webp" },
      "berita/slug",
    );
    expect(res).toEqual({ url: "u", key: "k", size: 9 });
  });

  it("skips processing (asRawUpload) when skipProcessing is set", async () => {
    r2Put.mockResolvedValue({ url: "u", key: "k", size: 3 });
    await uploadFile(Buffer.from("pdf"), "docs/a", { contentType: "application/pdf", skipProcessing: true });
    expect(asRawUpload).toHaveBeenCalledOnce();
    expect(processImage).not.toHaveBeenCalled();
    expect(r2Put).toHaveBeenCalledWith(
      { body: Buffer.from("pdf"), ext: "", contentType: "application/pdf" },
      "docs/a",
    );
  });

  it("routes to the UploadThing provider when selected", async () => {
    process.env.ADMIN_KIT_STORAGE_PROVIDER = "uploadthing";
    utPut.mockResolvedValue({ url: "ut", key: "utk", size: 9 });
    const res = await uploadFile(Buffer.from("img"), "x");
    expect(utPut).toHaveBeenCalledOnce();
    expect(r2Put).not.toHaveBeenCalled();
    expect(res.url).toBe("ut");
  });
});

describe("deleteObjectByUrl dispatch", () => {
  it("delegates to the active provider's deleteByUrl", async () => {
    r2Del.mockResolvedValue(true);
    const ok = await deleteObjectByUrl("https://cdn.example.com/x.webp");
    expect(r2Del).toHaveBeenCalledWith("https://cdn.example.com/x.webp");
    expect(ok).toBe(true);
  });
});
