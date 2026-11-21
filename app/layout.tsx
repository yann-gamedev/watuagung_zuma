import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { showSampleContent } from "@/lib/data";
import { siteOrigin } from "@/lib/urls";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

const origin = siteOrigin();
const isDemoBuild = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const indexable = Boolean(origin) && !isDemoBuild;
const description =
  "Sistem informasi dan pelayanan digital Desa Watuagung, Kecamatan Prigen, Kabupaten Pasuruan. Ajukan surat, pantau status, dan baca berita desa." +
  (showSampleContent ? " Prototipe dengan data contoh." : "");
const verification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
// Tanpa origin, gambar relatif akan diubah Next menjadi http://localhost:3000; jangan tebak domain.
const ogImages = origin
  ? [{ url: "/og/balai-desa.jpg", width: 1200, height: 630, alt: "Balai Desa Watuagung" }]
  : undefined;

export const metadata: Metadata = {
  ...(origin ? { metadataBase: new URL(origin) } : {}),
  title: {
    default: "Desa Watuagung | Informasi & Pelayanan Desa",
    template: "%s | Desa Watuagung",
  },
  description,
  openGraph: {
    title: "Desa Watuagung",
    description,
    siteName: "Desa Watuagung",
    locale: "id_ID",
    type: "website",
    ...(ogImages ? { images: ogImages } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: "Desa Watuagung",
    description,
    ...(ogImages ? { images: [ogImages[0].url] } : {}),
  },
  ...(verification ? { verification: { google: verification } } : {}),
  icons: { icon: "/favicon.svg" },
  robots: indexable
    ? { index: true, follow: true, googleBot: { index: true, follow: true } }
    : { index: false, follow: false, googleBot: { index: false, follow: false } },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
