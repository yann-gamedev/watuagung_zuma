import Link from "next/link";
import { notFound } from "next/navigation";
import { pages } from "@/lib/data";
import { PublicShell, PageHeading } from "@/components/site";
export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: pages[slug]?.title, description: pages[slug]?.intro };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();
  return (
    <PublicShell>
      <PageHeading {...page} />
      <section className="section container">
        <div className="notice">
          Konten contoh · Informasi resmi desa akan diperbarui setelah
          verifikasi.
        </div>
        <div className="content-grid">
          {page.blocks.map((b, i) => (
            <article className="content-card" key={b.title}>
              <div className="eyebrow">0{i + 1}</div>
              <h2>{b.title}</h2>
              <p>{b.text}</p>
            </article>
          ))}
        </div>
        {slug === "profil" && (
          <div className="button-row mt-8">
            {[
              ["Sejarah Desa", "sejarah"],
              ["Visi dan Misi", "visi-misi"],
              ["Struktur Pemerintahan", "struktur-pemerintahan"],
            ].map(([t, s]) => (
              <Link className="btn btn-secondary" href={"/" + s} key={s}>
                {t}
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
