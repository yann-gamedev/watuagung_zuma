import { news } from "@/lib/data";
import { PublicShell, PageHeading, NewsCard, NoOfficialNews } from "@/components/site";
import { Newspaper } from "lucide-react";
export const metadata = { title: "Berita Desa" };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
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
      {news.length === 0 ? (
        <section className="section container info-page">
          <NoOfficialNews />
        </section>
      ) : (
      <section className="section container">
        <div className="news-intro-row">
          <p className="news-intro-copy">Ikuti kabar kegiatan warga, perkembangan desa, layanan, dan inisiatif ekonomi lokal.</p>
          <span className="news-count">{news.length} cerita contoh</span>
        </div>
        <div className="notice news-sample-notice">
          <strong>Konten contoh</strong>
          <span>Seluruh berita di halaman ini adalah materi ilustrasi untuk pratinjau desain, bukan informasi resmi yang telah diverifikasi.</span>
        </div>
        <div className="news-grid">
          {news.map((n, i) => (
            <NewsCard key={n.slug} item={n} index={i} />
          ))}
        </div>
      </section>
      )}
    </PublicShell>
  );
}
