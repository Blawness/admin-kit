"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { signOutAction } from "./actions";

export type NavItem = {
  href?: string;
  label: string;
  icon?: ReactNode;
  requires?: string;
  children?: NavItem[];
};

function NavGroup({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const anyActive = item.children?.some(
    (c) => c.href && (pathname === c.href || pathname.startsWith(c.href))
  );
  const [expanded, setExpanded] = useState(false);

  const visible = item.children;

  if (!visible?.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-navy-300 transition-colors hover:bg-white/5 hover:text-white"
      >
        {item.icon && (
          <span className={`h-4 w-4 shrink-0 ${anyActive ? "text-gold-400" : ""}`}>
            {item.icon}
          </span>
        )}
        <span className={anyActive ? "font-medium text-white" : ""}>
          {item.label}
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && (
        <div className="ml-3 mt-1 space-y-1 border-l border-white/10 pl-3">
          {visible.map((c) => (
            <NavLink key={c.href} item={c} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  if (!item.href) return null;
  const active =
    pathname === item.href ||
    (item.href !== "/admin" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-white/10 font-medium text-white"
          : "text-navy-200 hover:bg-white/5 hover:text-white"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold-400" />
      )}
      {item.icon && (
        <span
          className={`h-4 w-4 shrink-0 ${
            active ? "text-gold-400" : "text-navy-300"
          }`}
        >
          {item.icon}
        </span>
      )}
      {item.label}
    </Link>
  );
}

export function AdminSidebar({ role, navItems, logoSrc = "/logo.png", brandName = "Admin" }: { role: string; navItems: NavItem[]; logoSrc?: string; brandName?: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-gradient-to-b from-navy-900 to-navy-950 text-navy-100">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
        <img src={logoSrc} alt="" className="h-8 w-8" />
        <div className="leading-none">
          <p className="font-heading text-sm font-extrabold text-white">{brandName}</p>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-gold-400">
            ADMIN
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) =>
          item.children ? (
            <NavGroup
              key={item.label}
              item={item}
              pathname={pathname}
            />
          ) : (
            <NavLink key={item.href} item={item} pathname={pathname} />
          )
        )}
      </nav>

      <div className="border-t border-white/5 p-3 space-y-1">
        <Link
          href="/admin/profile"
          className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === "/admin/profile"
              ? "bg-white/10 font-medium text-white"
              : "text-navy-200 hover:bg-white/5 hover:text-white"
          }`}
        >
          {pathname === "/admin/profile" && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold-400" />
          )}
          <User className="h-4 w-4 shrink-0" />
          Profil
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy-200 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
