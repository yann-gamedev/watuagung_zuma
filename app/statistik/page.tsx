import { PublicShell, PageHeading, StatisticCard } from "@/components/site";
import { UsersRound, House, MapPinned, Map as MapIcon } from "lucide-react";
import { statistics as s } from "@/lib/data";
export const metadata = { title: "Statistik Desa" };
const n = (value: number) => value.toLocaleString("id-ID");
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="WATUAGUNG DALAM ANGKA"
        title="Statistik Desa"
        intro="Mengenal desa melalui data kependudukan dan kegiatan ekonomi."
      />
      <section className="section container info-page statistics-page">
        <div className="notice">{s.source}</div>
        <div className="stats-grid">
          <StatisticCard
            value={n(s.population)}
            label="Penduduk"
            icon={<UsersRound />}
          />
          <StatisticCard
            value={n(s.households)}
            label="Kepala Keluarga"
            icon={<House />}
          />
          <StatisticCard value={n(s.hamlets)} label="Dusun" icon={<MapIcon />} />
          <StatisticCard
            value={`${s.rt} / ${s.rw}`}
            label="RT / RW"
            icon={<MapPinned />}
          />
        </div>
        <div className="content-grid mt-8">
          {s.groups.map((group) => {
            const max = Math.max(...group.rows.map(([, value]) => value));
            return (
              <div className="content-card" key={group.title}>
                <h2>{group.title}</h2>
                <p>Jumlah jiwa. Sumber: {group.source}</p>
                <div className="bars">
                  {group.rows.map(([label, value]) => (
                    <div className="bar-row" key={label}>
                      <div>
                        <span>{label}</span>
                        <strong>{n(value)} jiwa</strong>
                      </div>
                      <div className="bar-track">
                        <span style={{ width: (value / max) * 100 + "%" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="content-card">
            <h2>Kepala keluarga per dusun</h2>
            <p>Sumber: Kasi Pemerintahan, September 2025.</p>
            <div className="table-scroll mt-6">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dusun</th>
                    <th scope="col">Kepala keluarga</th>
                  </tr>
                </thead>
                <tbody>
                  {s.householdsByHamlet.map(([name, value]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{n(value)} KK</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="content-card">
            <h2>Data yang dapat dipercaya</h2>
            <p>
              Angka pada halaman ini berasal dari pendataan desa dan bisa
              berbeda dengan data Dukcapil. Data diperbarui setiap tahun.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
