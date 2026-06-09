import MediaLibraryScreen from "@blawness/admin-kit/screens/media";
import { handleDeleteMedia } from "@blawness/admin-kit/screens/media/lib";

async function deleteAction(formData: FormData) {
  "use server";
  // Demo has no other tables referencing media, so nothing blocks a delete.
  // A real app would count usages (article covers, banners, …) here.
  await handleDeleteMedia(formData, async () => 0);
}

export default function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; page?: string }>;
}) {
  return <MediaLibraryScreen deleteAction={deleteAction} searchParams={searchParams} />;
}
