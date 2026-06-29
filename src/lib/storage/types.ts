// Hasil pemrosesan gambar yang sudah siap di-unggah, lepas dari backend mana pun.
export type ProcessedUpload = { body: Buffer; ext: string; contentType: string };

// Kontrak satu backend penyimpanan. `put` menerima buffer yang sudah diproses
// dan keyBase (tanpa ekstensi); provider menentukan key/URL final.
export interface StorageProvider {
  name: "r2" | "uploadthing";
  put(p: ProcessedUpload, keyBase: string): Promise<{ url: string; key: string; size: number }>;
  deleteByUrl(url: string): Promise<boolean>;
}
