import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PageHeading, ServiceCard } from "@/components/site";
import { services } from "@/lib/data";
export const metadata: Metadata = { title: "Pelayanan Desa" };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="PELAYANAN WARGA"
        title="Pelayanan Desa"
        intro="Pilih layanan administrasi yang Anda butuhkan. Siapkan data dan ikuti langkah pengajuannya."
      />
      <section className="section container">
        <div className="notice">
          Prototipe layanan. Persyaratan dan waktu proses merupakan contoh.
          Gunakan data fiktif.
        </div>
        <div className="services-grid">
          {services.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
        </div>
        <div className="status-strip">
          <div>
            <strong>Sudah punya nomor pengajuan?</strong>
            <p>Lihat perkembangan permohonan Anda.</p>
          </div>
          <Link href="/pelayanan/status" className="text-link">
            Cek status permohonan →
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
