import Link from "next/link";
import { getPublishedArticles } from "@blawness/admin-kit/public";

export default async function BeritaIndex() {
  const posts = await getPublishedArticles({ limit: 20 });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-navy-900">Berita</h1>
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← Beranda
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-navy-200 bg-white px-4 py-10 text-center text-navy-500">
          Belum ada artikel yang dipublikasi. Buat & publish satu lewat{" "}
          <Link href="/admin/articles" className="text-brand-700 hover:underline">
            panel admin
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.id} className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
              <Link href={`/berita/${p.slug}`} className="block">
                <h2 className="font-heading text-xl font-semibold text-navy-900 hover:text-brand-700">
                  {p.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.categoryName ?? "Tanpa kategori"} · {p.authorName} ·{" "}
                  {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("id-ID") : ""}
                </p>
                {p.excerpt && <p className="mt-2 text-sm text-navy-600">{p.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
