import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!endpoint) throw new Error("admin-kit: R2_ENDPOINT env var is required");
if (!accessKeyId || !secretAccessKey) throw new Error("admin-kit: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY env vars are required");

export const R2_BUCKET = process.env.R2_BUCKET ?? "lipan-ri";
/** Base URL publik untuk menyajikan objek (r2.dev atau custom domain), tanpa trailing slash. */
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials:
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
});

/**
 * Resize + kompres gambar lalu unggah ke R2.
 * Apa pun ukuran input, hasil disimpan maksimal 1600px lebar, JPEG q80.
 * Mengembalikan URL publik yang siap disimpan ke kolom `featured_image`.
 */
export async function uploadImage(
  input: Buffer,
  /** key/nama objek di bucket, tanpa ekstensi — mis. "berita/slug-artikel" */
  keyBase: string
): Promise<{ url: string; key: string; size: number }> {
  const optimized = await sharp(input)
    .rotate() // hormati orientasi EXIF
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const key = `${keyBase.replace(/^\/+/, "")}.jpg`;

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: optimized,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  if (!R2_PUBLIC_URL) {
    throw new Error("R2_PUBLIC_URL belum di-set — tidak bisa menyusun URL publik.");
  }

  return { url: `${R2_PUBLIC_URL}/${key}`, key, size: optimized.length };
}

/**
 * Hapus objek dari R2 berdasarkan URL publiknya. Hanya menghapus objek yang
 * memang berada di bawah R2_PUBLIC_URL — URL eksternal/seed diabaikan dengan
 * aman (return false). Kegagalan jaringan dibiarkan melempar ke pemanggil.
 */
export async function deleteObjectByUrl(url: string): Promise<boolean> {
  if (!R2_PUBLIC_URL || !url.startsWith(`${R2_PUBLIC_URL}/`)) return false;
  const key = url.slice(R2_PUBLIC_URL.length + 1);
  if (!key) return false;
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  return true;
}
