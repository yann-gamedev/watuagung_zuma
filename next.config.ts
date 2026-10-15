import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    // Vercel pernah menyajikan CSS basi dari cache Turbopack; build demo dibuat bersih.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
