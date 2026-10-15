import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

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
    <html lang="id" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
