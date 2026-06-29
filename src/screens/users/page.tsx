import { requirePermission } from "../../lib/auth-helpers";
import { getActiveRbac } from "../../rbac/registry";
import { listUsers } from "../../lib/admin/users";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ConfirmDelete } from "../../components/confirm-delete";
import { createUserAction, resetPasswordAction, setRoleAction, deleteUserAction } from "./actions";
import { UserPlus, KeyRound, AlertCircle } from "lucide-react";

const selectClass =
  "h-9 rounded-md border border-navy-200 bg-white px-2.5 text-sm text-navy-900 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export default async function UsersScreen({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    email?: string;
    name?: string;
    role?: string;
  }>;
}) {
  const session = await requirePermission("users.read");
  const rows = await listUsers();
  const { error, email, name, role } = await searchParams;

  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-2xl font-bold text-navy-900">User</h1>
      <p className="mt-1 text-sm text-muted-foreground">{rows.length} akun</p>

      {error && (
        <p className="mt-4 flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <form
        action={createUserAction}
        className="mt-6 grid grid-cols-1 gap-2.5 rounded-xl border border-navy-100 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-navy-900 sm:col-span-2">
          <UserPlus className="h-4 w-4 text-brand-600" />
          Tambah user baru
        </p>
        <Input name="name" placeholder="Nama" required defaultValue={name} />
        <Input name="email" type="email" placeholder="Email" required defaultValue={email} />
        <Input name="password" type="password" placeholder="Password (min 8)" required />
        <select name="role" className={selectClass} defaultValue={role}>
          {Object.keys(getActiveRbac().config.roles).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <Button type="submit" className="sm:col-span-2">
          <UserPlus className="h-4 w-4" />
          Tambah User
        </Button>
      </form>

      <ul className="mt-6 divide-y divide-navy-50 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
        {rows.map((u) => {
          const isSelf = u.id === Number(session.user.id);
          const isAdmin = (u.role ?? "editor") === "admin";
          return (
            <li key={u.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-100 text-sm font-semibold uppercase text-navy-700">
                    {u.name?.[0] ?? u.email[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-navy-900">
                      <span className="truncate">{u.name}</span>
                      {isSelf && (
                        <span className="rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-medium text-navy-500">
                          Anda
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${
                    isAdmin
                      ? "bg-gold-100 text-gold-700 ring-gold-200"
                      : "bg-brand-50 text-brand-700 ring-brand-100"
                  }`}
                >
                  {u.role ?? "editor"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-navy-50 pt-3">
                <form action={setRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role ?? "editor"} className="h-8 rounded-md border border-navy-200 bg-white px-2 text-xs">
                    {Object.keys(getActiveRbac().config.roles).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" type="submit">Set Role</Button>
                </form>
                <form action={resetPasswordAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <Input name="password" type="password" placeholder="Password baru" className="h-8 w-36" />
                  <Button size="sm" variant="outline" type="submit">
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </form>
                {!isSelf && (
                  <div className="ml-auto">
                    <ConfirmDelete
                      action={deleteUserAction}
                      id={u.id}
                      title="Hapus user?"
                      description={
                        <>
                          User <span className="font-medium text-navy-900">{u.email}</span> akan dihapus.
                        </>
                      }
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
