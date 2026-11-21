import { PublicNews } from "@/features/news/public-news";
import { PublicShell, PageHeading } from "@/components/site";
import { Newspaper } from "lucide-react";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "Berita Desa",
  description: "Berita Desa Watuagung: cerita kegiatan, pembangunan, dan kebersamaan warga dari Pemerintah Desa Watuagung, Kecamatan Prigen, Kabupaten Pasuruan.",
  path: "/berita/",
});
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        editorial
        eyebrow="KABAR WATUAGUNG"
        title="Berita Desa"
        intro="Cerita kegiatan, pembangunan, dan kebersamaan warga."
        visual={
          <div className="news-heading-illustration">
            <span className="news-heading-icon"><Newspaper size={54} strokeWidth={1.35} /></span>
            <span className="news-heading-label">KABAR &amp; CERITA</span>
            <span className="news-heading-dot" />
          </div>
        }
      />
      <PublicNews />
    </PublicShell>
  );
}
