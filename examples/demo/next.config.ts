import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  // The package ships TS/JSX (and `use client` / `use cache` directives) — Next
  // must compile it.
  transpilePackages: ["@blawness/admin-kit"],
  // Required by the cached public read layer (`@blawness/admin-kit/public`).
  cacheComponents: true,
  turbopack: {
    // This demo lives inside the package repo and pulls source from the repo
    // root (../../src) via Tailwind @source. Raise Turbopack's root so those
    // files are within scope and get scanned/watched.
    root: join(process.cwd(), "..", ".."),
  },
};

export default nextConfig;
