import type { Metadata } from "next";
import { siteOrigin } from "@/lib/urls";

/** Metadata halaman publik: judul, deskripsi, canonical (hanya bila origin valid), dan OG/Twitter. */
export function pageMeta({
  title,
  description,
  path,
  absoluteTitle,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
}): Metadata {
  const ogTitle = absoluteTitle ? title : `${title} | Desa Watuagung`;
  const origin = siteOrigin();
  // Tanpa origin, gambar relatif akan diubah Next menjadi http://localhost:3000; jangan tebak domain.
  const images = origin
    ? [{ url: "/og/balai-desa.jpg", width: 1200, height: 630, alt: "Balai Desa Watuagung" }]
    : undefined;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(origin ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title: ogTitle,
      description,
      url: path,
      siteName: "Desa Watuagung",
      locale: "id_ID",
      type: "website",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      ...(images ? { images: [images[0].url] } : {}),
    },
  };
}
