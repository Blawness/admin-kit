import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage, asRawUpload } from "../src/lib/storage/process";

// Bangun gambar uji kecil agar tidak butuh fixture di disk.
async function makePng(opts: { alpha?: boolean } = {}): Promise<Buffer> {
  return sharp({
    create: {
      width: 10,
      height: 10,
      channels: opts.alpha ? 4 : 3,
      background: opts.alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .jpeg()
    .toBuffer();
}

describe("processImage", () => {
  it("exports PNG with alpha as webp", async () => {
    const out = await processImage(await makePng({ alpha: true }));
    expect(out.ext).toBe("webp");
    expect(out.contentType).toBe("image/webp");
    expect(out.body.length).toBeGreaterThan(0);
  });

  it("exports opaque jpeg as jpg", async () => {
    const out = await processImage(await makeJpeg());
    expect(out.ext).toBe("jpg");
    expect(out.contentType).toBe("image/jpeg");
  });
});

describe("asRawUpload", () => {
  it("passes the buffer through with no extension", () => {
    const buf = Buffer.from("hello");
    const out = asRawUpload(buf, "application/pdf");
    expect(out.ext).toBe("");
    expect(out.contentType).toBe("application/pdf");
    expect(out.body).toBe(buf);
  });
});
