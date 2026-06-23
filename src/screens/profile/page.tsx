import { requireUser } from "../../lib/auth-helpers";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { updateProfileAction, changePasswordAction } from "./actions";
import { User, KeyRound, AlertCircle, CheckCircle } from "lucide-react";

export default async function ProfileScreen({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; name?: string }>;
}) {
  const session = await requireUser();
  const { error, ok, name: prefillName } = await searchParams;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-900">Profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.user.email}
        </p>
      </div>

      {ok && (
        <p className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-100" role="alert">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Profil berhasil diperbarui.
        </p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Nama */}
      <form
        action={updateProfileAction}
        className="space-y-4 rounded-xl border border-navy-100 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-navy-400" />
          <h2 className="text-sm font-semibold text-navy-900">Nama</h2>
        </div>
        <div className="space-y-1">
          <label htmlFor="profile-name" className="text-sm font-medium text-navy-900">
            Nama
          </label>
          <Input
            id="profile-name"
            name="name"
            defaultValue={prefillName ?? (session.user.name ?? "")}
            required
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit">Simpan</Button>
          <span className="text-xs text-navy-400">
            Role: <span className="font-medium capitalize text-navy-600">{session.user.role}</span>
          </span>
        </div>
      </form>

      {/* Password */}
      <form
        action={changePasswordAction}
        className="space-y-4 rounded-xl border border-navy-100 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-navy-400" />
          <h2 className="text-sm font-semibold text-navy-900">Ganti Password</h2>
        </div>
        <div className="space-y-1">
          <label htmlFor="profile-current" className="text-sm font-medium text-navy-900">
            Password saat ini
          </label>
          <Input
            id="profile-current"
            name="current"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="profile-new" className="text-sm font-medium text-navy-900">
            Password baru
          </label>
          <Input
            id="profile-new"
            name="new"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit">Ganti Password</Button>
      </form>
    </div>
  );
}
