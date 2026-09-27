import { news } from "@/lib/data";
import { PublicShell, PageHeading, NewsCard } from "@/components/site";
export const metadata = { title: "Berita Desa" };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="KABAR WATUAGUNG"
        title="Berita Desa"
        intro="Cerita kegiatan, pembangunan, dan kebersamaan warga."
      />
      <section className="section container">
        <div className="notice">
          Seluruh berita pada prototipe adalah contoh.
        </div>
        <div className="news-grid">
          {news.map((n, i) => (
            <NewsCard key={n.slug} item={n} index={i} />
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
