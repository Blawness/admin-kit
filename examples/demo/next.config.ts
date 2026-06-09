import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The package ships TS/JSX (and `use client` / `use cache` directives) — Next
  // must compile it.
  transpilePackages: ["@blawness/admin-kit"],
  // Required by the cached public read layer (`@blawness/admin-kit/public`).
  cacheComponents: true,
};

export default nextConfig;
