import { Hero } from "@/components/hero";
import { TaskPanel } from "@/components/task-panel";
import { ServiceList } from "@/components/service-list";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/site";
import { news } from "@/lib/data";
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
              "Simpan keduanya untuk cek status; kode akses tidak bisa dipulihkan. Domisili, SKTM, dan KTP/KK diverifikasi RT → RW → desa → Kepala Desa. SKU langsung ke desa.",
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
              [RINGKASAN PROFIL DESA — 2–3 kalimat dari dokumen resmi desa]
            </p>
            <dl className="home-profile-stats">
              <div>
                <dt>Penduduk</dt>
                <dd>[JML]</dd>
              </div>
              <div>
                <dt>Dusun</dt>
                <dd>[JML]</dd>
              </div>
              <div>
                <dt>Luas wilayah</dt>
                <dd>[LUAS]</dd>
              </div>
            </dl>
            <div className="home-profile-actions">
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
      <section className="container home-bottom-container home-bottom home-news" aria-labelledby="news-title">
        <div className="home-news-heading">
          <h2 id="news-title">Kabar desa</h2>
          <Link href="/berita" className="home-bottom-link">
            Semua berita <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </div>
        <div className="home-news-grid">
          {news.map((item) => (
            <Link className="home-news-card" href={"/berita/" + item.slug} key={item.slug}>
              <div className="home-news-photo">[FOTO KEGIATAN]</div>
              <div className="home-news-body">
                <p className="home-news-meta">{item.category} · {item.date}</p>
                <h3>{item.title}</h3>
              </div>
            </Link>
          ))}
        </div>
        <p className="home-news-note">Berita contoh untuk pratinjau website.</p>
      </section>
      <section className="container home-bottom-container home-bottom home-economy" aria-label="BUMDes dan UMKM">
        <article className="home-economy-card home-bumdes">
          <h2>BUMDes [NAMA BUMDES]</h2>
          <p>[RINGKASAN BUMDES DAN UNIT USAHA — dari dokumen resmi desa]</p>
          <Link href="/bumdes" className="home-bottom-link">
            Lihat unit usaha <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </article>
        <article className="home-economy-card home-umkm">
          <h2>UMKM Watuagung</h2>
          <p>Daftar produk warga sedang disiapkan.</p>
          <span className="home-bottom-badge">Segera hadir</span>
          <Link href="/potensi" className="home-bottom-link">
            Lihat potensi desa <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </article>
      </section>
      <section className="container home-bottom-container home-bottom home-contact" aria-labelledby="contact-title">
        <div className="home-contact-card">
          <div>
            <h2 id="contact-title">Kantor Desa Watuagung</h2>
            <p>[ALAMAT LENGKAP KANTOR DESA]</p>
            <p>Buka [HARI &amp; JAM LAYANAN]</p>
            <Link href="/kontak" className="home-bottom-button">
              Lihat Kontak Kantor
            </Link>
          </div>
          <div className="home-contact-map">[PETA LOKASI KANTOR DESA]</div>
        </div>
      </section>
    </PublicShell>
  );
}
