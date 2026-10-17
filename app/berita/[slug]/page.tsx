import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { news } from "@/lib/data";
import { PublicShell, PageHeading } from "@/components/site";
export function generateStaticParams() {
  return news.map((n) => ({ slug: n.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: news.find((n) => n.slug === slug)?.title };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const n = news.find((x) => x.slug === slug);
  if (!n) notFound();
  return (
    <PublicShell>
      <PageHeading
        eyebrow={n.category}
        title={n.title}
        intro={n.date + " · Artikel contoh"}
        parent={{ label: "Berita Desa", href: "/berita" }}
      />
      <section className="section container">
        <article className="article-body">
          <div className="notice article-sample-notice">
            <strong>Artikel contoh</strong>
            <span>Konten ilustrasi untuk pratinjau website. Bukan laporan kegiatan resmi dan belum diverifikasi.</span>
          </div>
          <figure className="article-image">
            <div className="article-image-frame">
              <Image
                src="/village.jpg"
                alt="Petani menanam padi di sawah"
                fill
                sizes="(max-width: 820px) 100vw, 780px"
                priority
              />
            </div>
            <figcaption>Foto ilustrasi suasana pertanian desa, bukan dokumentasi kegiatan dalam artikel.</figcaption>
          </figure>
          <p className="article-lead">{n.summary}</p>
          <div className="article-copy">
            {n.content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="article-endnote">Informasi dalam artikel contoh ini perlu dikonfirmasi melalui kanal resmi desa.</div>
          <Link href="/berita" className="text-link article-back-link">
            ← Kembali ke berita desa
          </Link>
        </article>
      </section>
    </PublicShell>
  );
}
