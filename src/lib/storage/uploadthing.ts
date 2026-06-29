// src/lib/storage/uploadthing.ts
import type { ProcessedUpload, StorageProvider } from "./types";

// Import dinamis: konsumen R2-only tidak perlu memasang paket `uploadthing`.
async function getUTApi() {
  let mod: typeof import("uploadthing/server");
  try {
    mod = await import("uploadthing/server");
  } catch {
    throw new Error("admin-kit: pasang paket `uploadthing` untuk memakai storage provider UploadThing");
  }
  // UTApi membaca UPLOADTHING_TOKEN dari env secara otomatis.
  return new mod.UTApi();
}

// Ambil file key dari URL UploadThing (.../f/<key>) pada host ufs.sh / utfs.io.
function keyFromUrl(url: string): string | null {
  let host: string;
  let path: string;
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    return null;
  }
  if (!host.endsWith("ufs.sh") && host !== "utfs.io") return null;
  const m = path.match(/^\/f\/([^/?#]+)/);
  return m ? m[1] : null;
}

export const uploadThingProvider: StorageProvider = {
  name: "uploadthing",
  async put(p: ProcessedUpload, keyBase: string) {
    const utapi = await getUTApi();
    const base = keyBase.split("/").pop() || "upload";
    const fileName = p.ext ? `${base}.${p.ext}` : base;
    // `File` adalah global Node sejak v20 (Next.js 16 mensyaratkan Node 20.9+).
    const file = new File([new Uint8Array(p.body)], fileName, { type: p.contentType });
    const res = await utapi.uploadFiles(file);
    if (!res?.data || res.error) {
      throw new Error(`admin-kit: unggah ke UploadThing gagal${res?.error ? `: ${res.error.message}` : ""}`);
    }
    // `ufsUrl` adalah field aktif; `url` adalah alias lama (deprecated) untuk
    // kompatibilitas dengan rilis 7.x yang belum punya `ufsUrl`.
    const url = res.data.ufsUrl ?? res.data.url;
    if (!url) throw new Error("admin-kit: respons UploadThing tidak memuat URL file");
    return { url, key: res.data.key, size: p.body.length };
  },
  async deleteByUrl(url: string) {
    const key = keyFromUrl(url);
    if (!key) return false;
    const utapi = await getUTApi();
    await utapi.deleteFiles([key]);
    return true;
  },
};
