import { Hero } from '@/components/hero';
import Link from "next/link";
import {
  ArrowRight,
  UsersRound,
  House,
  MapPinned,
  Store,
  ShieldCheck,
  Search,
  MapPin,
  Sprout,
  ChevronRight,
} from "lucide-react";
import {
  PublicShell,
  SectionTitle,
  ServiceCard,
  StatisticCard,
  NewsCard,
} from "@/components/site";
import { services, news } from "@/lib/data";
export default function Home() {
  return (
    <PublicShell>
      <Hero />
      <div className="container stats-wrap">
        <div className="stats-grid">
          <StatisticCard
            value="4.286"
            label="Jumlah Penduduk"
            icon={<UsersRound />}
          />
          <StatisticCard
            value="1.342"
            label="Kepala Keluarga"
            icon={<House />}
          />
          <StatisticCard
            value="24 / 6"
            label="Jumlah RT / RW"
            icon={<MapPinned />}
          />
          <StatisticCard value="86" label="UMKM Desa" icon={<Store />} />
        </div>
        <div className="data-note">
          Data ilustrasi untuk prototipe · bukan data resmi desa
        </div>
      </div>
      <section className="section container">
        <SectionTitle
          eyebrow="PELAYANAN DESA"
          title="Urus keperluan, lebih mudah."
          description="Mulai pengajuan dari rumah. Kami bantu langkah selanjutnya."
          href="/pelayanan"
          link="Semua layanan"
        />
        <div className="services-grid">
          {services.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
        <div className="status-strip">
          <span className="icon-box">
            <Search size={22} />
          </span>
          <div>
            <strong>Sudah mengajukan permohonan?</strong>
            <p>Pantau proses pelayanan menggunakan nomor pengajuan Anda.</p>
          </div>
          <Link href="/pelayanan/status" className="text-link">
            Cek status permohonan <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className="about-section">
        <div className="container about-grid">
          <div className="about-visual">
            <div className="about-photo" />
            <span className="photo-label">
              ALAM YANG TERJAGA, WARGA YANG BERDAYA
            </span>
            <div className="about-mark">
              <Sprout size={28} />
              <span>
                Tumbuh bersama,
                <br />
                <strong>maju bersama.</strong>
              </span>
            </div>
          </div>
          <div>
            <div className="eyebrow">TENTANG WATUAGUNG</div>
            <h2>
              Berakar pada tradisi.
              <br />
              Bertumbuh untuk masa depan.
            </h2>
            <p>
              Di Watuagung, kebersamaan adalah kekuatan. Semangat gotong royong
              menghubungkan warga, menjaga alam, dan menggerakkan pembangunan
              desa.
            </p>
            <p>
              Kami menghadirkan pelayanan yang lebih dekat dan informasi yang
              lebih terbuka, agar setiap warga dapat ikut mengambil bagian.
            </p>
            <Link href="/profil" className="text-link">
              Kenali desa kami <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section container">
        <SectionTitle
          eyebrow="KABAR WATUAGUNG"
          title="Cerita dan kabar dari desa."
          description="Ikuti kegiatan, perkembangan, dan cerita kebersamaan warga."
          href="/berita"
          link="Semua berita"
        />
        <div className="news-grid">
          {news.map((n, i) => (
            <NewsCard key={n.slug} item={n} index={i} />
          ))}
        </div>
        <p className="data-note">Berita contoh untuk pratinjau website.</p>
      </section>
      <section className="potential-section">
        <div className="container potential-grid">
          <div>
            <div className="eyebrow light">POTENSI DESA</div>
            <h2>
              Kekayaan desa.
              <br />
              Kebanggaan bersama.
            </h2>
            <p>
              Dari hasil bumi hingga karya tangan warga, temukan potensi yang
              tumbuh di Watuagung.
            </p>
            <Link className="btn btn-gold" href="/potensi">
              Jelajahi potensi desa <ArrowRight size={17} />
            </Link>
          </div>
          <div className="potential-list">
            {[
              ["01", "Pertanian", "Mengolah tanah, menjaga keberlanjutan."],
              ["02", "UMKM Lokal", "Karya warga, penggerak ekonomi desa."],
              [
                "03",
                "Alam & Budaya",
                "Merawat warisan untuk generasi mendatang.",
              ],
            ].map(([n, t, d]) => (
              <Link href="/potensi" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
                <ArrowRight size={20} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section container civic-grid">
        <div>
          <SectionTitle
            eyebrow="AGENDA DESA"
            title="Mari ambil bagian."
            href="/agenda"
            link="Semua agenda"
          />
          {[
            ["20", "SEP", "Kerja bakti lingkungan", "07.00 WIB · Balai desa"],
            ["24", "SEP", "Pelatihan UMKM desa", "09.00 WIB · Balai desa"],
            ["28", "SEP", "Musyawarah warga", "19.30 WIB · Balai desa"],
          ].map(([d, m, t, s]) => (
            <Link className="agenda-row" href="/agenda" key={d}>
              <div className="date-box">
                <strong>{d}</strong>
                <span>{m}</span>
              </div>
              <div>
                <h3>{t}</h3>
                <p>{s}</p>
              </div>
              <ChevronRight size={20} />
            </Link>
          ))}
          <p className="data-note">Jadwal kegiatan contoh.</p>
        </div>
        <div className="transparency-card">
          <span className="icon-box">
            <ShieldCheck />
          </span>
          <div className="eyebrow">TRANSPARANSI DESA</div>
          <h2>
            Terbuka dalam anggaran.
            <br />
            Bersama dalam pembangunan.
          </h2>
          <p>
            Kenali arah pembangunan dan penggunaan anggaran desa melalui
            informasi publik yang mudah dipahami.
          </p>
          <Link href="/transparansi" className="text-link">
            Lihat informasi anggaran <ArrowRight size={18} />
          </Link>
          <div className="budget-bars">
            <span style={{ width: "40%" }} />
            <span style={{ width: "25%" }} />
            <span style={{ width: "20%" }} />
            <span style={{ width: "15%" }} />
          </div>
          <small>Ilustrasi alokasi anggaran desa</small>
        </div>
      </section>
      <section className="location-section">
        <div className="container location-grid">
          <div>
            <div className="eyebrow">LOKASI KANTOR DESA</div>
            <h2>Selalu dekat dengan warga.</h2>
            <p>
              Kantor Desa Watuagung menjadi pusat informasi dan pelayanan
              masyarakat.
            </p>
            <Link className="text-link" href="/kontak">
              Informasi kontak & jam pelayanan <ArrowRight size={18} />
            </Link>
          </div>
          <div className="location-placeholder">
            <MapPin size={34} />
            <strong>Kantor Desa Watuagung</strong>
            <span>Alamat dan titik peta menunggu verifikasi desa.</span>
          </div>
        </div>
      </section>
      <section className="container cta-section">
        <div>
          <div className="eyebrow">PELAYANAN DALAM GENGGAMAN</div>
          <h2>Langkah kecil, pelayanan lebih dekat.</h2>
          <p>Mulai pengajuan administrasi Anda melalui layanan digital desa.</p>
        </div>
        <Link className="btn" href="/pelayanan">
          Ajukan Layanan <ArrowRight size={18} />
        </Link>
      </section>
    </PublicShell>
  );
}
