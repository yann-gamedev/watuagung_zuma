import { Hero } from "@/components/hero";
import { TaskPanel } from "@/components/task-panel";
import { ServiceList } from "@/components/service-list";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/site";
import { OfficeContact } from "@/components/office-contact";
import { PublicNews } from "@/features/news/public-news";
import { SiteVideo } from "@/components/site-video";
import { HomeBusinesses } from "@/features/umkm/public-businesses";
export default function Home() {
  return (
    <PublicShell>
      <Hero />
      <TaskPanel />
      <ServiceList />
      <section className="container home-steps" aria-labelledby="steps-title">
        <h2 id="steps-title">Cara mengajukan surat</h2>
        <ol className="home-steps-list">
          {[
            [
              "Pilih jenis surat",
              "Baca persyaratannya, lalu isi formulir data diri.",
            ],
            [
              "Simpan nomor dan kode akses",
              "Simpan keduanya untuk cek status; jika kode hilang, minta kode baru ke kantor desa dengan membawa KTP/KK. Semua jenis surat diverifikasi petugas desa lalu disetujui Kepala Desa.",
            ],
            [
              "Ambil di kantor desa",
              "Datang setelah petugas menyatakan surat Anda siap.",
            ],
          ].map(([title, description], index) => (
            <li key={title}>
              <span className="home-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="home-profile home-bottom" aria-labelledby="profile-title">
        <div className="container home-bottom-container home-profile-grid">
          <div className="home-profile-photo">
            [FOTO KEPALA DESA / BALAI DESA]
          </div>
          <div>
            <div className="home-bottom-label">PROFIL DESA</div>
            <h2 id="profile-title">Mengenal Desa Watuagung</h2>
            <p className="home-profile-summary">
              Desa Watuagung berada di Kecamatan Prigen, Kabupaten Pasuruan,
              Jawa Timur, pada dataran pegunungan sekitar ±11 km dari
              kecamatan. Wilayahnya terdiri atas 3 dusun (Watuagung, Talang,
              dan Sekar) dengan 10 RW dan 31 RT.
            </p>
            <dl className="home-profile-stats">
              <div>
                <dt>Penduduk · Data Sept 2025</dt>
                <dd>4.819 jiwa</dd>
              </div>
              <div>
                <dt>Dusun</dt>
                <dd>3</dd>
              </div>
              <div>
                <dt>Luas wilayah</dt>
                <dd>[LUAS]</dd>
              </div>
            </dl>
            <p className="home-profile-summary home-profile-source">
              Sumber: penduduk dari Kasi Pemerintahan Desa Watuagung, September
              2025; dusun dari RKP Desa Watuagung 2027.
            </p>
            <div className="home-profile-actions mt-6">
              <Link href="/visi-misi" className="home-bottom-button home-bottom-gold">
                Visi &amp; Misi
              </Link>
              <Link href="/struktur-pemerintahan" className="home-bottom-button home-bottom-outline">
                Perangkat Desa
              </Link>
            </div>
          </div>
        </div>
      </section>
      <SiteVideo slot="profile" heading="Video profil desa" className="container home-bottom-container home-bottom home-video" />
      <PublicNews home />
      <section className="container home-bottom-container home-bottom home-economy" aria-label="BUMDes dan UMKM">
        <article className="home-economy-card home-bumdes">
          <h2>BUMDes Watuagung Bangkit</h2>
          <p>BUMDes Watuagung Bangkit berstatus aktif dengan unit usaha peternakan sapi, berdasarkan RKP Desa Watuagung 2027.</p>
          <Link href="/bumdes" className="home-bottom-link">
            Lihat unit usaha <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </article>
        <HomeBusinesses />
      </section>
      <section className="container home-bottom-container home-bottom home-contact" aria-labelledby="contact-title">
        <OfficeContact titleId="contact-title" />
        <Link href="/kontak" className="home-bottom-button mt-6">
          Lihat Kontak Kantor
        </Link>
      </section>
    </PublicShell>
  );
}
