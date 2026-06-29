import sharp from "sharp";
import type { ProcessedUpload } from "./types";

/**
 * Bungkus buffer non-gambar (PDF, dokumen) tanpa pemrosesan sharp.
 * `ext` dikosongkan agar pemanggil tidak menambah ekstensi.
 */
export function asRawUpload(input: Buffer, contentType: string): ProcessedUpload {
  return { body: input, ext: "", contentType: contentType || "application/octet-stream" };
}

/**
 * Resize + kompres gambar. Gambar ber-alpha atau PNG/WebP -> WebP (q80) agar
 * transparansi utuh; GIF beranimasi -> WebP beranimasi; gambar opak lain ->
 * JPEG q80 maks lebar 1600px.
 */
export async function processImage(input: Buffer): Promise<ProcessedUpload> {
  const meta = await sharp(input).metadata();
  const isAnimated = (meta.pages ?? 1) > 1;
  const hasAlpha = meta.hasAlpha === true;
  const isPngOrWebp = meta.format === "png" || meta.format === "webp";

  if (isAnimated) {
    const body = await sharp(input, { animated: true }).webp().toBuffer();
    return { body, ext: "webp", contentType: "image/webp" };
  }
  if (hasAlpha || isPngOrWebp) {
    const body = await sharp(input)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { body, ext: "webp", contentType: "image/webp" };
  }
  const body = await sharp(input)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return { body, ext: "jpg", contentType: "image/jpeg" };
}
