"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../lib/auth-helpers";
import { uploadImage } from "../../lib/r2";
import { db } from "../../db/index";
import { media } from "../../db/schema";
import { OK_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../../lib/upload-constants";
import { logAudit } from "../../lib/audit";

export async function uploadImageAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const session = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  if (!OK_IMAGE_TYPES.includes(file.type)) return { error: "Format gambar tidak didukung." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "Ukuran gambar maksimal 8MB." };

  // Tandai sumber unggahan (mis. "gallery" atau "cover") agar konsumen bisa
  // membedakan/membersihkan media. Default ke "gallery" bila tidak diisi.
  const albumRaw = formData.get("album");
  const album = typeof albumRaw === "string" && albumRaw.trim() ? albumRaw.trim() : "gallery";

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

  const [row] = await db.insert(media).values({ url, altText: file.name, album }).returning({ id: media.id });
  logAudit({
    actorId: Number(session.user.id),
    action: "media.upload",
    entityType: "media",
    entityId: row.id,
    metadata: { album, fileName: file.name },
  }).catch(() => {});

  revalidatePath("/admin/media");
  return { url };
}
