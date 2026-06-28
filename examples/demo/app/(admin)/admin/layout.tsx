import "../../../rbac";
import type { ReactNode } from "react";
import { AdminLayout } from "@blawness/admin-kit/shell";
import {
  LayoutDashboard,
  FileText,
  Tags,
  Image as ImageIcon,
  Users,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/articles", label: "Artikel", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/categories", label: "Kategori", icon: <Tags className="h-4 w-4" /> },
  { href: "/admin/media", label: "Galeri", icon: <ImageIcon className="h-4 w-4" /> },
  { href: "/admin/users", label: "User", icon: <Users className="h-4 w-4" />, requires: "users.read" },
];

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <AdminLayout navItems={navItems} brandName="Admin Kit Demo">
      {children}
    </AdminLayout>
  );
}
