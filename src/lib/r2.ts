import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

let _r2: S3Client | null = null;

/**
 * Bangun & cache S3Client untuk R2 pada pemanggilan pertama. Validasi env
 * dilakukan di sini (lazy) agar mengimpor modul ini tidak pernah melempar saat
 * env belum tersedia (mis. saat `next build` di aplikasi konsumen).
 */
function getR2(): S3Client {
  if (_r2) return _r2;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint) throw new Error("admin-kit: R2_ENDPOINT env var is required");
  if (!accessKeyId || !secretAccessKey) throw new Error("admin-kit: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY env vars are required");

  _r2 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _r2;
}

/** Nama bucket R2 (wajib di-set). */
export function R2_BUCKET(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("admin-kit: R2_BUCKET env var is required");
  return bucket;
}

/** Base URL publik untuk menyajikan objek (r2.dev atau custom domain), tanpa trailing slash. */
export function R2_PUBLIC_URL(): string {
  return (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
}

/** S3Client R2 yang di-inisialisasi secara lazy. */
export function r2(): S3Client {
  return getR2();
}

/**
 * Unggah buffer sembarang ke R2 tanpa pemrosesan gambar (lewatkan sharp).
 * Gunakan ini untuk PDF, dokumen, atau berkas non-gambar lainnya.
 */
export async function uploadFile(
  input: Buffer,
  /** key/nama objek di bucket, tanpa ekstensi — mis. "dokumen/laporan-2025" */
  keyBase: string,
  opts?: { contentType?: string; skipProcessing?: boolean }
): Promise<{ url: string; key: string; size: number }> {
  const skip = opts?.skipProcessing === true;
  let body: Buffer;
  let ext: string;
  let contentType: string;

  if (skip) {
    body = input;
    ext = "";
    contentType = opts?.contentType ?? "application/octet-stream";
  } else {
    const meta = await sharp(input).metadata();
    const isAnimated = (meta.pages ?? 1) > 1;
    const hasAlpha = meta.hasAlpha === true;
    const isPngOrWebp = meta.format === "png" || meta.format === "webp";

    if (isAnimated) {
      body = await sharp(input, { animated: true }).webp().toBuffer();
      ext = "webp";
      contentType = "image/webp";
    } else if (hasAlpha || isPngOrWebp) {
      body = await sharp(input)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      ext = "webp";
      contentType = "image/webp";
    } else {
      body = await sharp(input)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      ext = "jpg";
      contentType = "image/jpeg";
    }
  }

  const key = ext ? `${keyBase.replace(/^\/+/, "")}.${ext}` : keyBase.replace(/^\/+/, "");

  await getR2().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const publicUrl = R2_PUBLIC_URL();
  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL belum di-set — tidak bisa menyusun URL publik.");
  }

  return { url: `${publicUrl}/${key}`, key, size: body.length };
}

/**
 * Resize + kompres gambar lalu unggah ke R2.
 * Format input dipertahankan secara cerdas: gambar dengan alpha channel atau
 * PNG/WebP diekspor sebagai WebP (q80) agar transparansi tetap utuh, GIF
 * beranimasi diekspor sebagai WebP beranimasi agar animasinya tidak hilang,
 * sedangkan gambar opak lainnya tetap di-resize maks 1600px lebar & JPEG q80.
 * Mengembalikan URL publik yang siap disimpan ke kolom `featured_image`.
 */
export async function uploadImage(
  input: Buffer,
  /** key/nama objek di bucket, tanpa ekstensi — mis. "berita/slug-artikel" */
  keyBase: string
): Promise<{ url: string; key: string; size: number }> {
  return uploadFile(input, keyBase);
}

/**
 * Hapus objek dari R2 berdasarkan URL publiknya. Hanya menghapus objek yang
 * memang berada di bawah R2_PUBLIC_URL — URL eksternal/seed diabaikan dengan
 * aman (return false). Kegagalan jaringan dibiarkan melempar ke pemanggil.
 */
export async function deleteObjectByUrl(url: string): Promise<boolean> {
  const publicUrl = R2_PUBLIC_URL();
  if (!publicUrl || !url.startsWith(`${publicUrl}/`)) return false;
  const key = url.slice(publicUrl.length + 1);
  if (!key) return false;
  await getR2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
  return true;
}
