import { requireUser } from "../../lib/auth-helpers";
import { countArticles, listArticles, type ArticleFilters } from "../../lib/admin/articles";
import { countMedia } from "../../lib/admin/media";
import { listUsers } from "../../lib/admin/users";
import { listCategories, listTags } from "../../lib/admin/categories";
import { listAuditLogs } from "../../lib/audit";
import {
  FileText,
  Image,
  Users,
  FolderOpen,
  Tag,
  CheckCircle,
  Clock,
  PenTool,
  Shield,
} from "lucide-react";

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorClass}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-navy-500">{label}</p>
        <p className="text-2xl font-bold text-navy-900">{value}</p>
      </div>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Login",
  "user.create": "Buat user",
  "user.delete": "Hapus user",
  "user.set_role": "Ubah role user",
  "user.reset_password": "Reset password user",
  "article.create": "Buat artikel",
  "article.update": "Edit artikel",
  "article.delete": "Hapus artikel",
  "article.submit": "Ajukan review artikel",
  "article.publish": "Publikasi artikel",
  "article.reject": "Tolak artikel",
  "category.create": "Buat kategori",
  "category.delete": "Hapus kategori",
  "tag.create": "Buat tag",
  "tag.delete": "Hapus tag",
  "media.upload": "Upload media",
  "media.delete": "Hapus media",
};

function statusBadge(status: string) {
  if (status === "published")
    return (
      <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        Publikasi
      </span>
    );
  if (status === "pending_review")
    return (
      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        Review
      </span>
    );
  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      Draft
    </span>
  );
}

export default async function DashboardScreen() {
  await requireUser();

  const articleFilters: ArticleFilters = {};

  const [
    totalArticles,
    publishedCount,
    draftCount,
    pendingCount,
    totalMedia,
    usersList,
    categoriesList,
    tagsList,
    recentArticles,
    recentActivity,
  ] = await Promise.all([
    countArticles(articleFilters),
    countArticles({ ...articleFilters, status: "published" }),
    countArticles({ ...articleFilters, status: "draft" }),
    countArticles({ ...articleFilters, status: "pending_review" }),
    countMedia(),
    listUsers(),
    listCategories(),
    listTags(),
    listArticles({ limit: 5 }),
    listAuditLogs({ limit: 8 }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold text-navy-900">
        Dashboard
      </h1>

      {/* Article stats */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy-400">
          Artikel
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={FileText}
            label="Total"
            value={totalArticles}
            colorClass="bg-navy-100 text-navy-700"
          />
          <StatCard
            icon={CheckCircle}
            label="Dipublikasi"
            value={publishedCount}
            colorClass="bg-green-100 text-green-700"
          />
          <StatCard
            icon={PenTool}
            label="Draft"
            value={draftCount}
            colorClass="bg-amber-100 text-amber-700"
          />
          <StatCard
            icon={Clock}
            label="Review"
            value={pendingCount}
            colorClass="bg-blue-100 text-blue-700"
          />
        </div>
      </section>

      {/* Other stats */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy-400">
          Lainnya
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Image}
            label="Media"
            value={totalMedia}
            colorClass="bg-purple-100 text-purple-700"
          />
          <StatCard
            icon={Users}
            label="User"
            value={usersList.length}
            colorClass="bg-teal-100 text-teal-700"
          />
          <StatCard
            icon={FolderOpen}
            label="Kategori"
            value={categoriesList.length}
            colorClass="bg-orange-100 text-orange-700"
          />
          <StatCard
            icon={Tag}
            label="Tag"
            value={tagsList.length}
            colorClass="bg-pink-100 text-pink-700"
          />
        </div>
      </section>

      {/* Recent articles + activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-navy-900">
            Artikel Terbaru
          </h3>
          {recentArticles.length === 0 ? (
            <p className="text-sm text-navy-400">Belum ada artikel.</p>
          ) : (
            <div className="divide-y divide-navy-50">
              {recentArticles.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="truncate text-sm font-medium text-navy-900">
                      {a.title}
                    </p>
                    <p className="text-xs text-navy-400">
                      {a.authorName ?? "—"}
                    </p>
                  </div>
                  {statusBadge(a.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-navy-900">
            Aktivitas Terbaru
          </h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-navy-400">Belum ada aktivitas.</p>
          ) : (
            <div className="divide-y divide-navy-50">
              {recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-navy-300" />
                  <div className="min-w-0">
                    <p className="text-sm text-navy-900">
                      <span className="font-medium">
                        {entry.actorName ?? entry.actorEmail ?? `#${entry.actorId}`}
                      </span>
                      {" — "}
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <p className="text-xs text-navy-400">
                      {new Date(entry.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
