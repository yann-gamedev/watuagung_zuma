import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Desa Watuagung | Informasi & Pelayanan Desa",
    template: "%s | Desa Watuagung",
  },
  description:
    "Sistem Informasi dan Pelayanan Digital Desa Watuagung. Akses profil, berita, transparansi, dan pengajuan surat desa. Prototipe dengan data contoh.",
  openGraph: {
    title: "Desa Watuagung",
    description: "Membangun Desa, Melayani Warga Lebih Dekat",
    locale: "id_ID",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
