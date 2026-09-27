import { PublicShell, PageHeading, StatisticCard } from "@/components/site";
import { UsersRound, House, MapPinned, Store } from "lucide-react";
export const metadata = { title: "Statistik Desa" };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="WATUAGUNG DALAM ANGKA"
        title="Statistik Desa"
        intro="Mengenal desa melalui data kependudukan dan kegiatan ekonomi."
      />
      <section className="section container">
        <div className="notice">
          Semua angka adalah data contoh, bukan statistik resmi desa.
        </div>
        <div className="stats-grid">
          <StatisticCard value="4.286" label="Penduduk" icon={<UsersRound />} />
          <StatisticCard
            value="1.342"
            label="Kepala Keluarga"
            icon={<House />}
          />
          <StatisticCard value="24 / 6" label="RT / RW" icon={<MapPinned />} />
          <StatisticCard value="86" label="UMKM" icon={<Store />} />
        </div>
        <div className="content-grid mt-8">
          <div className="content-card">
            <h2>Kelompok usia</h2>
            <div className="bars">
              {[
                ["0–14 tahun", 23],
                ["15–64 tahun", 68],
                ["65 tahun ke atas", 9],
              ].map(([label, value]) => (
                <div className="bar-row" key={label}>
                  <div>
                    <span>{label}</span>
                    <strong>{value}%</strong>
                  </div>
                  <div className="bar-track">
                    <span style={{ width: value + "%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="content-card">
            <h2>Data yang dapat dipercaya</h2>
            <p>
              Statistik resmi akan mencantumkan sumber, periode pendataan, dan
              tanggal pembaruan. Angka pada halaman ini hanya digunakan untuk
              menunjukkan tampilan informasi.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
