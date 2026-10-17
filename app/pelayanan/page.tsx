import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PageHeading } from "@/components/site";
import { ServiceList } from "@/components/service-list";
export const metadata: Metadata = { title: "Pelayanan Desa" };
export default function Page() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="PELAYANAN WARGA"
        title="Pelayanan Desa"
        intro="Pilih layanan administrasi yang Anda butuhkan. Siapkan data dan ikuti langkah pengajuannya."
      />
      <section className="section container service-page">
        <div className="notice">
          Prototipe layanan. Persyaratan dan waktu proses merupakan contoh.
          Gunakan data fiktif.
        </div>
        <ServiceList fullRequirements />
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
