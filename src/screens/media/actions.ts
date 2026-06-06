"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../lib/auth-helpers";
import { uploadImage } from "../../lib/r2";
import { db } from "../../db/index";
import { media } from "../../db/schema";

const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadImageAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  if (!OK_TYPES.includes(file.type)) return { error: "Format gambar tidak didukung." };
  if (file.size > MAX_BYTES) return { error: "Ukuran gambar maksimal 8MB." };

  const buf = Buffer.from(await file.arrayBuffer());
  const keyBase = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let url: string;
  try {
    // sharp (inside uploadImage) throws on data that isn't really an image,
    // e.g. a non-image file sent with a spoofed image MIME type.
    ({ url } = await uploadImage(buf, keyBase));
  } catch {
    return { error: "Gambar gagal diproses. Pastikan berkas benar-benar gambar." };
  }

  await db.insert(media).values({ url, altText: file.name });
  revalidatePath("/admin/media");
  return { url };
}
