// src/lib/storage/index.ts
import type { StorageProvider } from "./types";
import { processImage, asRawUpload } from "./process";
import { r2Provider, R2_BUCKET, R2_PUBLIC_URL, r2 } from "./r2";

export type { ProcessedUpload, StorageProvider } from "./types";
export { R2_BUCKET, R2_PUBLIC_URL, r2 };

/** Normalisasi nilai env menjadi nama provider yang valid. */
export function resolveProviderName(raw: string | undefined): "r2" | "uploadthing" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || v === "r2") return "r2";
  if (v === "uploadthing") return "uploadthing";
  throw new Error(
    `admin-kit: ADMIN_KIT_STORAGE_PROVIDER tidak dikenal: "${raw}". Gunakan "r2" atau "uploadthing".`,
  );
}

let _provider: StorageProvider | null = null;

/** Resolusi + cache provider aktif berdasarkan env (lazy). */
export async function getActiveProvider(): Promise<StorageProvider> {
  if (_provider) return _provider;
  const name = resolveProviderName(process.env.ADMIN_KIT_STORAGE_PROVIDER);
  if (name === "uploadthing") {
    const { uploadThingProvider } = await import("./uploadthing");
    _provider = uploadThingProvider;
  } else {
    _provider = r2Provider;
  }
  return _provider;
}

/** Reset cache provider — hanya untuk test agar tidak bocor antar berkas uji. */
export function _resetProviderForTests(): void {
  _provider = null;
}

/**
 * Unggah buffer sembarang. Gambar diproses sharp; non-gambar (skipProcessing)
 * dilewatkan apa adanya. Mengembalikan URL publik dari provider aktif.
 */
export async function uploadFile(
  input: Buffer,
  keyBase: string,
  opts?: { contentType?: string; skipProcessing?: boolean },
): Promise<{ url: string; key: string; size: number }> {
  const processed = opts?.skipProcessing
    ? asRawUpload(input, opts.contentType ?? "application/octet-stream")
    : await processImage(input);
  const provider = await getActiveProvider();
  return provider.put(processed, keyBase);
}

/** Resize + kompres gambar lalu unggah ke provider aktif. */
export async function uploadImage(
  input: Buffer,
  keyBase: string,
): Promise<{ url: string; key: string; size: number }> {
  return uploadFile(input, keyBase);
}

/** Hapus objek lewat URL publiknya pada provider aktif. */
export async function deleteObjectByUrl(url: string): Promise<boolean> {
  const provider = await getActiveProvider();
  return provider.deleteByUrl(url);
}
