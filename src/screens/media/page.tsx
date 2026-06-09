import Link from "next/link";
import { listMedia, countMedia } from "../../lib/admin/media";
import { requireUser } from "../../lib/auth-helpers";
import { ConfirmDelete } from "../../components/confirm-delete";
import { GalleryUploader } from "./uploader";
import { Trash2, ImageOff, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export default async function MediaLibraryScreen({
  deleteAction,
  searchParams,
}: {
  deleteAction: (fd: FormData) => Promise<void>;
  searchParams: Promise<{ error?: string; page?: string }>;
}) {
  await requireUser();
  const { error, page: rawPage } = await searchParams;

  const total = await countMedia();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(rawPage) || 1), pageCount);
  const items = await listMedia({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  const pageHref = (p: number) => (p > 1 ? `/admin/media?page=${p}` : "/admin/media");

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-navy-900">Galeri</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} gambar tersimpan
        </p>
      </div>

      {error && (
        <p className="mb-4 flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <GalleryUploader />

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-navy-200 bg-white py-16 text-center">
          <ImageOff className="h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm font-medium text-navy-700">Belum ada gambar</p>
          <p className="text-xs text-muted-foreground">
            Unggah gambar pertama lewat kotak di atas.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <div
              key={m.id}
              className="group relative overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- R2 URL */}
              <img
                src={m.url}
                alt={m.altText ?? ""}
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute right-2 top-2">
                <ConfirmDelete
                  action={deleteAction}
                  id={m.id}
                  title="Hapus gambar?"
                  description="Gambar akan dihapus permanen dari media."
                  trigger={
                    <button
                      type="button"
                      aria-label="Hapus gambar"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-navy-600 opacity-100 shadow-sm ring-1 ring-navy-100 backdrop-blur transition-all hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between" aria-label="Navigasi halaman">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              rel="prev"
              className="rounded-md border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50"
            >
              ← Sebelumnya
            </Link>
          ) : (
            <span className="rounded-md border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-300">
              ← Sebelumnya
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Halaman {page} dari {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={pageHref(page + 1)}
              rel="next"
              className="rounded-md border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50"
            >
              Berikutnya →
            </Link>
          ) : (
            <span className="rounded-md border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-300">
              Berikutnya →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
