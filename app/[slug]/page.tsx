import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { complaintFormUrl, complaintNote, externalLinkProps } from "@/lib/complaint";
import { pages, showSampleContent } from "@/lib/data";
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
      <section className="section container info-page">
        {/* Tanpa konten contoh, agenda/pengumuman hanya berisi keadaan kosong resmi. */}
        {![
          "profil", "struktur-pemerintahan", "sejarah", "visi-misi", "potensi", "transparansi",
          ...(showSampleContent ? [] : ["agenda", "pengumuman"]),
        ].includes(slug) && (
          <div className="notice">
            Konten contoh · Informasi resmi desa akan diperbarui setelah
            verifikasi.
          </div>
        )}
        {slug === "kontak" ? (
          <div className="info-contact">
            <article className="home-contact-card">
              <div>
                <h2>Kantor Desa Watuagung</h2>
                <p>{page.blocks[0].text}</p>
                <p>Buka [HARI &amp; JAM LAYANAN]</p>
                <p>Telepon: [NOMOR TELEPON KANTOR DESA]</p>
                <p>Email: [EMAIL KANTOR DESA]</p>
              </div>
              <div className="home-contact-map">[PETA LOKASI KANTOR DESA]</div>
            </article>
            {complaintFormUrl ? (
              <article className="info-complaint">
                <h2>Pengaduan</h2>
                <p>{complaintNote} Formulir dibuka di tab baru.</p>
                <p>
                  Jangan menuliskan NIK, nomor KK, atau data pribadi lain di
                  formulir pengaduan. Untuk hal mendesak, datang langsung ke
                  kantor desa.
                </p>
                <a className="btn mt-4" href={complaintFormUrl} {...externalLinkProps}>
                  Sampaikan pengaduan <ExternalLink size={22} aria-hidden="true" />
                  <span className="sr-only"> (dibuka di tab baru)</span>
                </a>
              </article>
            ) : (
              <article className="info-complaint">
                <h2>Pengaduan <span aria-hidden="true">— </span><span className="home-bottom-badge">Segera hadir</span></h2>
                <p>
                  Layanan pengaduan melalui website belum tersedia. Untuk sementara,
                  silakan sampaikan pengaduan langsung ke kantor desa.
                </p>
              </article>
            )}
          </div>
        ) : (
          <div className="content-grid">
            {page.blocks.map((block) => (
              <article className="content-card" key={block.title}>
                <h2>{block.title}</h2>
                <p>{block.text}</p>
              </article>
            ))}
          </div>
        )}
        {slug === "profil" && (
          <div className="button-row mt-8">
            {[
              ["Sejarah Desa", "sejarah"],
              ["Visi dan Misi", "visi-misi"],
              ["Struktur Pemerintahan", "struktur-pemerintahan"],
              ["Statistik Desa", "statistik"],
            ].map(([title, target]) => (
              <Link className="btn btn-secondary" href={"/" + target} key={target}>
                {title}
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
