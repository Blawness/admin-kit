import { redirect } from "next/navigation";
import { requirePermission } from "../../lib/auth-helpers";
import { deleteObjectByUrl } from "../../lib/storage/index";
import { getMediaById, deleteMediaRow } from "../../lib/admin/media";
import { revalidatePath } from "next/cache";
import { getActiveRbac } from "../../rbac/registry";
import { logAudit } from "../../lib/audit";

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

  const isAdmin = getActiveRbac().can(session.user.role, "media.manageAny");
  if (!isAdmin && row.uploadedBy !== Number(session.user.id)) {
    logAudit({
      actorId: Number(session.user.id),
      action: "media.access_denied",
      entityType: "media",
      entityId: id,
      metadata: { attemptedAction: "delete" },
    }).catch(() => {});
    redirect(`/admin/media?error=${encodeURIComponent("Tidak diizinkan menghapus gambar ini.")}`);
  }

  // Hapus objek R2 lebih dulu; bila gagal, biarkan melempar agar row DB tetap
  // ada dan operasi bisa diulang (hindari row hilang tapi objek menggantung).
  await deleteObjectByUrl(row.url);
  await deleteMediaRow(id, { userId: Number(session.user.id), isAdmin });
  revalidatePath("/admin/media");
}
