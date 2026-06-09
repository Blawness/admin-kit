import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-navy-900">
        @blawness/admin-kit — demo
      </h1>
      <p className="mt-2 text-navy-600">
        Aplikasi konsumen minimal untuk mencoba paket admin-kit secara lokal.
      </p>

      <div className="mt-8 grid gap-3">
        <Link
          href="/admin"
          className="rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
        >
          → Buka Panel Admin (/admin)
        </Link>
        <Link
          href="/berita"
          className="rounded-lg border border-navy-200 px-4 py-3 font-semibold text-navy-700 transition-colors hover:bg-navy-50"
        >
          → Lihat halaman publik (/berita)
        </Link>
        <Link
          href="/rss.xml"
          className="rounded-lg border border-navy-200 px-4 py-3 font-semibold text-navy-700 transition-colors hover:bg-navy-50"
        >
          → RSS feed (/rss.xml)
        </Link>
        <Link
          href="/sitemap.xml"
          className="rounded-lg border border-navy-200 px-4 py-3 font-semibold text-navy-700 transition-colors hover:bg-navy-50"
        >
          → Sitemap (/sitemap.xml)
        </Link>
      </div>

      <p className="mt-8 rounded-lg bg-gold-50 px-4 py-3 text-sm text-gold-800 ring-1 ring-gold-200">
        Login dengan kredensial hasil seed (lihat output <code>pnpm seed</code>).
      </p>
    </main>
  );
}
