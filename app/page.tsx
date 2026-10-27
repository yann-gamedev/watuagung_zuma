import { Hero } from "@/components/hero";
import { TaskPanel } from "@/components/task-panel";
import { ServiceList } from "@/components/service-list";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/site";
import { news, pages } from "@/lib/data";
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
              "Simpan keduanya untuk cek status; jika kode hilang, minta kode baru ke RT/RW atau kantor desa dengan KTP/KK. Domisili, SKTM, dan KTP/KK diverifikasi RT → RW → desa → Kepala Desa. SKU langsung ke desa.",
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
            <p className="home-profile-summary">
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
      {/* Tanpa berita resmi bagian ini tidak dirender; /berita tetap tertaut di header dan footer. */}
      {news.length > 0 && (
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
      )}
      <section className="container home-bottom-container home-bottom home-economy" aria-label="BUMDes dan UMKM">
        <article className="home-economy-card home-bumdes">
          <h2>BUMDes Watuagung Bangkit</h2>
          <p>BUMDes Watuagung Bangkit berstatus aktif dengan unit usaha peternakan sapi, berdasarkan RKP Desa Watuagung 2027.</p>
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
            <p>{pages.kontak.blocks[0].text}</p>
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
