"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import type { ComponentType } from "react";
import { signOutAction } from "./actions";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

export function AdminSidebar({ role, navItems }: { role: string; navItems: NavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-gradient-to-b from-navy-900 to-navy-950 text-navy-100">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
        <img src="/logo.png" alt="" className="h-8 w-8" />
        <div className="leading-none">
          <p className="font-heading text-sm font-extrabold text-white">LIPAN RI</p>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-gold-400">
            ADMIN
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems
          .filter((l) => !l.adminOnly || role === "admin")
          .map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/admin" && pathname.startsWith(l.href));
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-white/10 font-medium text-white"
                    : "text-navy-200 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold-400" />
                )}
                <Icon
                  className={`h-4 w-4 ${active ? "text-gold-400" : "text-navy-300"}`}
                />
                {l.label}
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-white/5 p-3">
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
