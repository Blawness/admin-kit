import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPublishedArticleBySlug,
  getPublishedArticleSlugs,
} from "@blawness/admin-kit/public";

export async function generateStaticParams() {
  const slugs = await getPublishedArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug);
  if (!a) return {};
  const description = a.metaDescription ?? a.excerpt ?? undefined;
  const image = a.ogImage ?? a.coverImageUrl ?? undefined;
  return {
    title: a.metaTitle ?? a.title,
    description,
    openGraph: {
      title: a.metaTitle ?? a.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BeritaDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await getPublishedArticleBySlug(slug);
  if (!a) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/berita" className="text-sm text-brand-700 hover:underline">
        ← Semua berita
      </Link>

      <h1 className="mt-4 font-heading text-3xl font-bold text-navy-900">{a.title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {a.categoryName ?? "Tanpa kategori"} · {a.authorName} ·{" "}
        {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("id-ID") : ""}
      </p>

      {a.coverImageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={a.coverImageUrl} alt="" className="mt-6 w-full rounded-xl" />
      )}

      {a.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {a.tags.map((t) => (
            <span key={t.id} className="rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-600">
              #{t.name}
            </span>
          ))}
        </div>
      )}

      <div
        className="prose-content mt-6 text-navy-800"
        dangerouslySetInnerHTML={{ __html: a.content ?? "" }}
      />
    </main>
  );
}
