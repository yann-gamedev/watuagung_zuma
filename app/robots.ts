import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/urls";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const origin = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/persetujuan/", "/verifikasi-email/", "/berhenti-email/", "/api/"],
    },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
