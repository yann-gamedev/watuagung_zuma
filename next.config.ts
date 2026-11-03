import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    // CSS basi pernah muncul di Vercel dan dev setelah merge; kompilasi ulang tanpa cache persisten.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
