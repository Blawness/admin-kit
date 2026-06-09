import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Admin Kit Demo",
  description: "Demo consumer app for @blawness/admin-kit",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
