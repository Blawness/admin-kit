"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../lib/auth-helpers";
import { uploadImage, uploadFile } from "../../lib/r2";
import { db } from "../../db/index";
import { media } from "../../db/schema";
import { OK_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../../lib/upload-constants";
import { logAudit } from "../../lib/audit";

export async function uploadImageAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const session = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };

  const allowedRaw = formData.get("allowedTypes");
  const allowedTypes: string[] | null =
    typeof allowedRaw === "string" && allowedRaw.trim()
      ? allowedRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
  const maxBytesRaw = formData.get("maxBytes");
  const maxBytes =
    typeof maxBytesRaw === "string" && maxBytesRaw.trim()
      ? Number(maxBytesRaw)
      : MAX_IMAGE_BYTES;

  if (allowedTypes && !allowedTypes.includes(file.type))
    return { error: "Format berkas tidak didukung." };
  if (allowedTypes === null && !OK_IMAGE_TYPES.includes(file.type))
    return { error: "Format gambar tidak didukung." };
  if (file.size > maxBytes)
    return { error: `Ukuran berkas maksimal ${Math.round(maxBytes / (1024 * 1024))}MB.` };

  // Tandai sumber unggahan (mis. "gallery" atau "cover") agar konsumen bisa
  // membedakan/membersihkan media. Default ke "gallery" bila tidak diisi.
  const albumRaw = formData.get("album");
  const album = typeof albumRaw === "string" && albumRaw.trim() ? albumRaw.trim() : "gallery";

  const buf = Buffer.from(await file.arrayBuffer());
  const keyBase = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let url: string;
  try {
    if (file.type.startsWith("image/")) {
      ({ url } = await uploadImage(buf, keyBase));
    } else {
      ({ url } = await uploadFile(buf, keyBase, { contentType: file.type, skipProcessing: true }));
    }
  } catch {
    return { error: "Berkas gagal diproses." };
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
