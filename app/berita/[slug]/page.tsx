import { notFound } from "next/navigation";
import Link from "next/link";
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
        intro={n.date + " · Redaksi Desa · Berita contoh"}
      />
      <section className="section container">
        <article className="article-body">
          <div className="notice">
            Artikel ilustrasi, bukan laporan kegiatan resmi.
          </div>
          <p>{n.text}</p>
          <p>
            Informasi kegiatan, dokumentasi, dan narasumber akan dilengkapi
            setelah konfirmasi pemerintah desa.
          </p>
          <Link href="/berita" className="text-link">
            ← Kembali ke berita desa
          </Link>
        </article>
      </section>
    </PublicShell>
  );
}
