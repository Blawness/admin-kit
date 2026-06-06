"use client";

import { useRouter } from "next/navigation";
import { Images } from "lucide-react";
import { ImageUpload } from "../../components/admin/image-upload";
import { uploadImageAction } from "./actions";

export function GalleryUploader() {
  const router = useRouter();
  return (
    <div className="max-w-xl rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Images className="h-4 w-4 text-brand-600" />
        <p className="text-sm font-semibold text-navy-900">Tambah gambar ke galeri</p>
      </div>
      <ImageUpload uploadAction={uploadImageAction} onChange={() => router.refresh()} />
    </div>
  );
}
