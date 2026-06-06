import { requireAdmin } from "../../lib/auth-helpers";
import { listCategories, listTags } from "../../lib/admin/categories";
import { ConfirmDelete } from "../../components/confirm-delete";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  createCategoryAction,
  deleteCategoryAction,
  createTagAction,
  deleteTagAction,
} from "./actions";
import { Tag, FolderOpen, AlertCircle, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CategoriesScreen({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const [categories, tags] = await Promise.all([listCategories(), listTags()]);
  const { error } = await searchParams;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-900">Kategori & Tag</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola kategori dan tag artikel.
        </p>
      </div>

      {error && (
        <p
          className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Categories */}
      <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-900">
          <FolderOpen className="h-4 w-4 text-brand-600" />
          Kategori ({categories.length})
        </h2>
        <form action={createCategoryAction} className="mb-4 flex gap-2">
          <Input name="name" placeholder="Nama kategori" required className="flex-1" />
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </form>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada kategori.</p>
        ) : (
          <ul className="divide-y divide-navy-50">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm font-medium text-navy-900">{c.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.slug}</span>
                </div>
                <ConfirmDelete
                  action={deleteCategoryAction}
                  id={c.id}
                  title="Hapus kategori?"
                  description={
                    <>
                      Kategori{" "}
                      <span className="font-medium text-navy-900">{c.name}</span>{" "}
                      akan dihapus. Artikel yang menggunakannya tidak ikut terhapus.
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tags */}
      <section className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Tag className="h-4 w-4 text-brand-600" />
          Tag ({tags.length})
        </h2>
        <form action={createTagAction} className="mb-4 flex gap-2">
          <Input name="name" placeholder="Nama tag" required className="flex-1" />
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </form>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada tag.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-1 rounded-full bg-navy-50 py-1 pl-3 pr-1 text-xs font-medium text-navy-700 ring-1 ring-navy-100"
              >
                {tag.name}
                <ConfirmDelete
                  action={deleteTagAction}
                  id={tag.id}
                  title="Hapus tag?"
                  description={
                    <>
                      Tag <span className="font-medium text-navy-900">{tag.name}</span> akan dihapus.
                    </>
                  }
                  trigger={
                    <button
                      type="button"
                      aria-label={`Hapus tag ${tag.name}`}
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-navy-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      ×
                    </button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
