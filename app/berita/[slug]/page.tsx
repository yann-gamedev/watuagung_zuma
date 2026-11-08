import { notFound } from "next/navigation";
import { isDemo } from "@/services/pelayanan";
import { LegacyNewsRedirect } from "@/features/news/legacy-news-redirect";
import Link from "next/link";
import { NewsArticle } from "@/features/news/news-article";
import { news } from "@/lib/data";
import { PublicShell, PageHeading, NoOfficialNews } from "@/components/site";
// Next 16 menolak generateStaticParams kosong; tanpa berita, satu slug pengganti menampilkan keadaan kosong.
const emptySlug = "belum-ada";
export function generateStaticParams() {
  return news.length ? news.map((n) => ({ slug: n.slug })) : [{ slug: emptySlug }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: news.find((n) => n.slug === slug)?.title ?? "Berita Desa" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isDemo) return <PublicShell><section className="section container"><LegacyNewsRedirect slug={slug} /></section></PublicShell>;
  if (!news.length && slug === emptySlug)
    return (
      <PublicShell>
        <PageHeading
          editorial
          eyebrow="KABAR WATUAGUNG"
          title="Berita Desa"
          intro="Cerita kegiatan, pembangunan, dan kebersamaan warga."
          parent={{ label: "Berita Desa", href: "/berita" }}
        />
        <section className="section container info-page">
          <NoOfficialNews />
        </section>
      </PublicShell>
    );
  const n = news.find((x) => x.slug === slug);
  if (!n) notFound();
  return (
    <PublicShell>
      <PageHeading
        editorial
        eyebrow={n.category}
        title={n.title}
        intro={n.date + " · Konten contoh"}
        parent={{ label: "Berita Desa", href: "/berita" }}
      />
      <section className="section container">
        <NewsArticle title={n.title} summary={n.summary} body={n.content.join("\n\n")} sample={true}>
          <Link href="/berita" className="text-link article-back-link">
            ← Kembali ke berita desa
          </Link>
        </NewsArticle>
      </section>
    </PublicShell>
  );
}
