import Link from "next/link";
import { requireUser } from "../../lib/auth-helpers";
import { listArticles, countArticles, type ArticleStatus } from "../../lib/admin/articles";
import { ConfirmDelete } from "../../components/confirm-delete";
import { deleteArticleAction } from "./actions";
import { PlusCircle, AlertCircle, FileText, Search } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Draft",
  pending_review: "Menunggu Review",
  published: "Published",
};

const STATUS_CLASSES: Record<ArticleStatus, string> = {
  draft: "bg-navy-100 text-navy-600 ring-navy-200",
  pending_review: "bg-gold-100 text-gold-700 ring-gold-200",
  published: "bg-brand-50 text-brand-700 ring-brand-100",
};

const FILTER_TABS: { label: string; value: ArticleStatus | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Menunggu Review", value: "pending_review" },
  { label: "Published", value: "published" },
];

const VALID_STATUSES = new Set<string>(["draft", "pending_review", "published"]);

export default async function ArticlesScreen({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; q?: string; page?: string }>;
}) {
  const session = await requireUser();
  const { status, error, q: rawQ, page: rawPage } = await searchParams;
  const isAdmin = session.user.role === "admin";

  const validStatus =
    status && VALID_STATUSES.has(status) ? (status as ArticleStatus) : undefined;
  const q = rawQ?.trim() || undefined;
  const authorId = isAdmin ? undefined : Number(session.user.id);

  const total = await countArticles({ status: validStatus, authorId, q });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(rawPage) || 1), pageCount);

  const items = await listArticles({
    status: validStatus,
    authorId,
    q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  // Build a URL for this list preserving status + search, setting the page.
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (validStatus) sp.set("status", validStatus);
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/admin/articles?${qs}` : "/admin/articles";
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-900">Artikel</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} artikel</p>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <PlusCircle className="h-4 w-4" />
          Tulis Artikel
        </Link>
      </div>

      {error && (
        <p
          className="mb-4 flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTER_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={
                tab.value === "all"
                  ? "/admin/articles"
                  : `/admin/articles?status=${tab.value}`
              }
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                (tab.value === "all" && !validStatus) || tab.value === validStatus
                  ? "bg-navy-900 text-white"
                  : "text-navy-600 hover:bg-navy-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Server-side search (GET) — preserves the active status filter. */}
        <form className="flex items-center gap-1.5">
          {validStatus && <input type="hidden" name="status" value={validStatus} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-navy-400" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari judul atau slug…"
              aria-label="Cari artikel"
              className="h-9 w-56 rounded-md border border-navy-200 bg-white pl-8 pr-2.5 text-sm text-navy-900 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-md bg-navy-900 px-3 text-xs font-medium text-white transition-colors hover:bg-navy-800"
          >
            Cari
          </button>
        </form>
      </div>

      {q && (
        <p className="mb-3 text-xs text-muted-foreground">
          {total} hasil untuk &ldquo;{q}&rdquo; ·{" "}
          <Link
            href={validStatus ? `/admin/articles?status=${validStatus}` : "/admin/articles"}
            className="text-brand-600 hover:underline"
          >
            Reset
          </Link>
        </p>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-navy-200 bg-white py-16 text-center">
          <FileText className="h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm font-medium text-navy-700">
            {q || validStatus ? "Tidak ada artikel yang cocok" : "Belum ada artikel"}
          </p>
          <p className="text-xs text-muted-foreground">
            {q || validStatus ? "Coba ubah pencarian atau filter." : "Mulai tulis artikel pertama."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-navy-50 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-900">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.authorName} · {item.categoryName ?? "Tanpa kategori"} ·{" "}
                  {new Date(item.createdAt!).toLocaleDateString("id-ID")}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_CLASSES[item.status as ArticleStatus]}`}
              >
                {STATUS_LABELS[item.status as ArticleStatus]}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/articles/edit?id=${item.id}`}
                  className="rounded-md border border-navy-200 px-2.5 py-1 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50"
                >
                  Edit
                </Link>
                {isAdmin && (
                  <ConfirmDelete
                    action={deleteArticleAction}
                    id={item.id}
                    title="Hapus artikel?"
                    description={
                      <>
                        Artikel{" "}
                        <span className="font-medium text-navy-900">{item.title}</span>{" "}
                        akan dihapus permanen.
                      </>
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
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
