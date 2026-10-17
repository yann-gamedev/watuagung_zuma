import Link from "next/link";
import { notFound } from "next/navigation";
import { pages } from "@/lib/data";
import { PublicShell, PageHeading } from "@/components/site";

const profileLinks = [
  { slug: "profil", label: "Profil" },
  { slug: "sejarah", label: "Sejarah" },
  { slug: "visi-misi", label: "Visi & Misi" },
  { slug: "struktur-pemerintahan", label: "Perangkat Desa" },
];

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
      {profileLinks.some((link) => link.slug === slug) && (
        <nav className="container info-profile-nav" aria-label="Halaman profil desa">
          {profileLinks.map((link) => (
            <Link
              href={"/" + link.slug}
              key={link.slug}
              aria-current={slug === link.slug ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      <section className="section container info-page">
        <div className="notice">
          Konten contoh · Informasi resmi desa akan diperbarui setelah
          verifikasi.
        </div>
        {slug === "kontak" ? (
          <div className="info-contact">
            <article className="home-contact-card">
              <div>
                <h2>Kantor Desa Watuagung</h2>
                <p>[ALAMAT LENGKAP KANTOR DESA]</p>
                <p>Buka [HARI &amp; JAM LAYANAN]</p>
                <p>Telepon: [NOMOR TELEPON KANTOR DESA]</p>
                <p>Email: [EMAIL KANTOR DESA]</p>
              </div>
              <div className="home-contact-map">[PETA LOKASI KANTOR DESA]</div>
            </article>
            <article className="info-complaint">
              <h2>Pengaduan <span aria-hidden="true">— </span><span className="home-bottom-badge">Segera hadir</span></h2>
              <p>
                Layanan pengaduan melalui website belum tersedia. Untuk sementara,
                silakan sampaikan pengaduan langsung ke kantor desa.
              </p>
            </article>
          </div>
        ) : slug === "visi-misi" ? (
          <div className="info-vision-mission">
            <article className="content-card">
              <h2>{page.blocks[0].title}</h2>
              <blockquote>{page.blocks[0].text}</blockquote>
            </article>
            <ol className="info-mission-list" aria-label="Misi desa">
              {page.blocks.slice(1).map((block) => (
                <li className="content-card" key={block.title}>
                  <h2>{block.title.replace(/^Misi \d+ · /, "")}</h2>
                  <p>{block.text}</p>
                </li>
              ))}
            </ol>
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
      </section>
    </PublicShell>
  );
}
