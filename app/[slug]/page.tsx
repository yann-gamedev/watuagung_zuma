import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Sprout, MapPin, Landmark, Wheat, House, HandHeart } from "lucide-react";
import { complaintFormUrl, complaintNote, externalLinkProps } from "@/lib/complaint";
import { pages, showSampleContent } from "@/lib/data";
import { PublicShell, PageHeading } from "@/components/site";
import { ProfileInstitutionChips } from "@/components/profile-institution-chips";

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
      {slug === "visi-misi" ? (
        <div className="visi-heading-wrap"><PageHeading {...page} /></div>
      ) : (
        <PageHeading {...page} />
      )}
      <section className={`section container info-page${slug === "visi-misi" ? " visi-misi-page" : ""}`}>
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
        {slug === "visi-misi" && page.visionMission ? (
          <div className="constructive-page">
            <section className="constructive-board" aria-labelledby="visi-misi-title">
              <h2 className="sr-only" id="visi-misi-title">Visi dan Misi</h2>
              <article className="content-card profile-card constructive-vision">
                <h3>Visi</h3>
                <p className="constructive-vision-copy"><span className="visi-quote-mark" aria-hidden="true">“</span>{page.visionMission.vision.text}<span className="visi-quote-mark" aria-hidden="true">”</span></p>
                <p className="source">{page.visionMission.vision.source}</p>
              </article>
              <section className="content-card profile-card constructive-missions" aria-labelledby="misi-heading">
                <h3 className="constructive-missions-title" id="misi-heading">Misi</h3>
                <ol>
                {page.visionMission.missions.map((mission, index) => {
                  const number = String(index + 1).padStart(2, "0");
                  return (
                    <li className="constructive-mission" key={number}>
                      <span className="constructive-number" aria-hidden="true">{number}</span>
                      <div>
                        <h4 className="sr-only">Misi {number}</h4>
                        <p>{mission}</p>
                      </div>
                    </li>
                  );
                })}
                </ol>
              </section>
            </section>
            <article className="content-card profile-card constructive-theme">
              <div className="constructive-theme-copy">
                <h3>Tema pembangunan 2027</h3>
                <p>{page.visionMission.theme.text}</p>
              </div>
            </article>
          </div>
        ) : slug === "kontak" ? (
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
          slug === "profil" && page.profileDetails ? (
            <div className="content-grid profile-bento">
              <article className="content-card profile-card profile-growth">
                <h2><Sprout aria-hidden="true" />{page.blocks[0].title}</h2>
                <p className="profile-lead">{page.blocks[0].text.split(" Pertanian,")[0]}</p>
                <ul className="profile-themes">
                  {page.profileDetails.themes.map((theme, index) => {
                    const Icon = [Wheat, House, HandHeart][index];
                    return <li key={theme}><Icon aria-hidden="true" />{theme}</li>;
                  })}
                </ul>
              </article>
              <article className="content-card profile-card profile-region">
                <h2><MapPin aria-hidden="true" />{page.blocks[1].title}</h2>
                <div className="profile-region-location">
                  <h3 className="sr-only">Lokasi</h3>
                  <p className="profile-location">{page.profileDetails.location}</p>
                </div>
                {/* Inisialisasi peta interaktif dapat ditempatkan di dalam kontainer ini. */}
                <div id="village-map" className="profile-map-placeholder" role="region" aria-label="Peta wilayah Desa Watuagung">
                  <svg className="profile-map-contours" viewBox="0 0 800 450" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 54C170 42 285 66 410 54S650 43 800 57" />
                    <path d="M0 122C150 111 278 134 405 121s252-12 395 2" />
                    <path d="M0 190c154-13 270 13 406 0s250-14 394 1" />
                    <path d="M0 258c166-12 276 12 408 0s246-14 392 1" />
                    <path d="M0 326c160-12 276 12 408 0s246-14 392 1" />
                    <path d="M0 394c155-12 275 12 408 0s246-14 392 1" />
                    <path d="M68 0c-10 81 11 135 0 218s9 150 0 232" />
                    <path d="M178 0c-9 78 10 139 0 218s9 151 0 232" />
                    <path d="M288 0c-8 80 9 138 0 218s8 150 0 232" />
                    <path d="M398 0c-8 80 9 138 0 218s8 150 0 232" />
                    <path d="M508 0c-8 80 9 138 0 218s8 150 0 232" />
                    <path d="M618 0c-8 80 9 138 0 218s8 150 0 232" />
                    <path d="M728 0c-8 80 9 138 0 218s8 150 0 232" />
                  </svg>
                  <span className="profile-map-caption">Peta interaktif segera hadir</span>
                </div>
                <dl className="profile-area-row"><div><dt>Luas wilayah</dt><dd>Sedang dikonfirmasi</dd></div></dl>
                <dl className="profile-key-figures">
                  {page.profileDetails.stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
                </dl>
                <p className="profile-hamlet-names">{page.profileDetails.stats.find((stat) => stat.label === "Dusun")?.detail}</p>
                <div className="profile-region-bounds">
                  <h3>Batas wilayah</h3>
                  <dl className="profile-boundaries">
                    {page.profileDetails.boundaries.map((item) => <div key={item.direction}><dt>{item.direction}</dt><dd>{item.place}</dd></div>)}
                  </dl>
                </div>
                <small className="profile-source profile-region-source">{page.profileDetails.source}</small>
              </article>
              <article className="content-card profile-card profile-institutions">
                <h2><Landmark aria-hidden="true" />{page.blocks[2].title}</h2>
                <ProfileInstitutionChips items={page.profileDetails.institutions} />
                <small className="profile-source">{page.profileDetails.source}</small>
              </article>
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
          )
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
