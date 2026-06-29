import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn(function () {
      this.send = send;
    }),
    PutObjectCommand: vi.fn(function (input) {
      this.__type = "Put";
      this.input = input;
    }),
    DeleteObjectCommand: vi.fn(function (input) {
      this.__type = "Delete";
      this.input = input;
    }),
  };
});

beforeEach(() => {
  vi.resetModules();
  send.mockReset();
  send.mockResolvedValue({});
  process.env.R2_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
  process.env.R2_ACCESS_KEY_ID = "ak";
  process.env.R2_SECRET_ACCESS_KEY = "sk";
  process.env.R2_BUCKET = "bucket";
  process.env.R2_PUBLIC_URL = "https://cdn.example.com";
});

describe("r2Provider.put", () => {
  it("builds key with extension and returns public url", async () => {
    const { r2Provider } = await import("../src/lib/storage/r2");
    const res = await r2Provider.put(
      { body: Buffer.from("x"), ext: "webp", contentType: "image/webp" },
      "uploads/abc",
    );
    expect(res.key).toBe("uploads/abc.webp");
    expect(res.url).toBe("https://cdn.example.com/uploads/abc.webp");
    expect(res.size).toBe(1);
    expect(send).toHaveBeenCalledOnce();
  });

  it("rejects and uploads nothing when R2_PUBLIC_URL is unset", async () => {
    delete process.env.R2_PUBLIC_URL;
    const { r2Provider } = await import("../src/lib/storage/r2");
    await expect(
      r2Provider.put({ body: Buffer.from("x"), ext: "webp", contentType: "image/webp" }, "uploads/a"),
    ).rejects.toThrow(/R2_PUBLIC_URL/);
    expect(send).not.toHaveBeenCalled();
  });

  it("omits extension when ext is empty", async () => {
    const { r2Provider } = await import("../src/lib/storage/r2");
    const res = await r2Provider.put(
      { body: Buffer.from("x"), ext: "", contentType: "application/pdf" },
      "uploads/doc",
    );
    expect(res.key).toBe("uploads/doc");
  });
});

describe("r2Provider.deleteByUrl", () => {
  it("deletes objects under the public url", async () => {
    const { r2Provider } = await import("../src/lib/storage/r2");
    const ok = await r2Provider.deleteByUrl("https://cdn.example.com/uploads/abc.webp");
    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });

  it("ignores foreign urls", async () => {
    const { r2Provider } = await import("../src/lib/storage/r2");
    const ok = await r2Provider.deleteByUrl("https://other.com/x.png");
    expect(ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
