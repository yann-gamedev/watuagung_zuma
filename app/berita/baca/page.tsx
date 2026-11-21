import { Suspense } from "react";
import { PublicShell } from "@/components/site";
import { NewsDetailPage } from "@/features/news/news-detail";

export const metadata = { title: "Baca Berita", robots: { index: false, follow: true } };
export default function Page() {
  return <PublicShell><Suspense fallback={<section className="section container"><p role="status">Memuat berita…</p></section>}><NewsDetailPage /></Suspense></PublicShell>;
}
