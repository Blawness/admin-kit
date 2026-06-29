import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { ProcessedUpload, StorageProvider } from "./types";

let _r2: S3Client | null = null;

function getR2(): S3Client {
  if (_r2) return _r2;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint) throw new Error("admin-kit: R2_ENDPOINT env var is required");
  if (!accessKeyId || !secretAccessKey)
    throw new Error("admin-kit: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY env vars are required");
  _r2 = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  return _r2;
}

export function R2_BUCKET(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("admin-kit: R2_BUCKET env var is required");
  return bucket;
}

export function R2_PUBLIC_URL(): string {
  return (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
}

export function r2(): S3Client {
  return getR2();
}

export const r2Provider: StorageProvider = {
  name: "r2",
  async put(p: ProcessedUpload, keyBase: string) {
    const publicUrl = R2_PUBLIC_URL();
    if (!publicUrl) throw new Error("R2_PUBLIC_URL belum di-set — tidak bisa menyusun URL publik.");
    const base = keyBase.replace(/^\/+/, "");
    const key = p.ext ? `${base}.${p.ext}` : base;
    await getR2().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET(),
        Key: key,
        Body: p.body,
        ContentType: p.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { url: `${publicUrl}/${key}`, key, size: p.body.length };
  },
  async deleteByUrl(url: string) {
    const publicUrl = R2_PUBLIC_URL();
    if (!publicUrl || !url.startsWith(`${publicUrl}/`)) return false;
    const key = url.slice(publicUrl.length + 1);
    if (!key) return false;
    await getR2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: key }));
    return true;
  },
};
