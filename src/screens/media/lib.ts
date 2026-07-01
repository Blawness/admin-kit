import { redirect } from "next/navigation";
import { requirePermission } from "../../lib/auth-helpers";
import { deleteObjectByUrl } from "../../lib/storage/index";
import { getMediaById, deleteMediaRow } from "../../lib/admin/media";
import { revalidatePath } from "next/cache";

/**
 * Generic delete-media logic, extracted from the server action so that the
 * consuming app can inject its own reference checker (posts, banners, etc.).
 *
 * @param formData - FormData containing "id" field
 * @param referenceChecker - async fn that returns the count of references to the given URL
 */
export async function handleDeleteMedia(
  formData: FormData,
  referenceChecker: (url: string) => Promise<number>,
): Promise<void> {
  const session = await requirePermission("media.delete");
  void session;
  const id = Number(formData.get("id"));
  if (!id) return;

  const row = await getMediaById(id);
  if (!row) return;

  const refs = await referenceChecker(row.url);
  if (refs > 0) {
    redirect(
      `/admin/media?error=${encodeURIComponent(
        `Gambar masih dipakai oleh ${refs} konten. Lepas dulu dari berita/banner sebelum menghapus.`
      )}`
    );
  }

  // Hapus objek R2 lebih dulu; bila gagal, biarkan melempar agar row DB tetap
  // ada dan operasi bisa diulang (hindari row hilang tapi objek menggantung).
  await deleteObjectByUrl(row.url);
  await deleteMediaRow(id);
  revalidatePath("/admin/media");
}
