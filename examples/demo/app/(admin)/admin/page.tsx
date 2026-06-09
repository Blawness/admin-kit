import Link from "next/link";
import { requireUser } from "@blawness/admin-kit/auth-helpers";

export default async function Dashboard() {
  const session = await requireUser();
  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-2xl font-bold text-navy-900">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Masuk sebagai {session.user.email} ({session.user.role})
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/articles" className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm transition-colors hover:border-brand-300">
          <p className="font-semibold text-navy-900">Artikel</p>
          <p className="text-sm text-muted-foreground">Tulis, cari, paginasi, ajukan & publish.</p>
        </Link>
        <Link href="/admin/media" className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm transition-colors hover:border-brand-300">
          <p className="font-semibold text-navy-900">Galeri</p>
          <p className="text-sm text-muted-foreground">Unggah gambar (butuh R2) & paginasi.</p>
        </Link>
        <Link href="/admin/categories" className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm transition-colors hover:border-brand-300">
          <p className="font-semibold text-navy-900">Kategori & Tag</p>
          <p className="text-sm text-muted-foreground">Kelola taksonomi artikel.</p>
        </Link>
        <Link href="/admin/users" className="rounded-xl border border-navy-100 bg-white p-5 shadow-sm transition-colors hover:border-brand-300">
          <p className="font-semibold text-navy-900">User</p>
          <p className="text-sm text-muted-foreground">Admin/editor, reset password, hapus.</p>
        </Link>
      </div>
    </div>
  );
}
