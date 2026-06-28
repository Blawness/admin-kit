import type { ReactNode } from "react";
import { auth } from "../auth/index";
import { Toaster } from "sonner";
import { AdminSidebar, type NavItem } from "./sidebar";
import { getActiveRbac } from "../rbac/registry";
import { filterNavItems } from "../rbac/nav";

export async function AdminLayout({
  navItems,
  children,
  logoSrc,
  brandName,
}: {
  navItems: NavItem[];
  children: ReactNode;
  logoSrc?: string;
  brandName?: string;
}) {
  const session = await auth();

  // The only unauthenticated route reachable here is /admin/login: the proxy
  // redirects every other /admin/* to login, and each admin page additionally
  // calls requireUser()/requirePermission() before touching data.
  // So rendering bare children here (no shell) cannot leak protected content.
  if (!session?.user) {
    return <>{children}</>;
  }

  const role = session.user.role;
  const rbac = getActiveRbac();
  const visibleNav = filterNavItems(navItems, (perm) => rbac.can(role, perm));
  return (
    <div className="flex min-h-screen bg-navy-50/60">
      <AdminSidebar navItems={visibleNav} logoSrc={logoSrc} brandName={brandName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-navy-100 bg-white/80 px-6 backdrop-blur-sm">
          <span className="text-sm font-medium text-navy-500">Panel Admin</span>
          <div className="flex items-center gap-2.5">
            <span className="hidden text-sm text-navy-600 sm:inline">
              {session.user.email}
            </span>
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold capitalize text-brand-700 ring-1 ring-brand-100">
              {session.user.role}
            </span>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
