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
        <section className="service-steps" aria-labelledby="service-steps-title">
          <h2 id="service-steps-title">Cara mengajukan surat</h2>
          <ol className="home-steps-list" role="list">
            {[
              ["Pilih dan ajukan surat", "Baca persyaratan surat yang Anda butuhkan, lalu isi formulir."],
              ["Simpan bukti pengajuan", "Simpan nomor pengajuan dan kode akses untuk mengecek perkembangan surat."],
              ["Cek status dan ambil surat", "Datang ke kantor desa setelah status surat dinyatakan siap diambil."],
            ].map(([title, description], index) => (
              <li key={title}>
                <span className="home-step-number" aria-hidden="true">{index + 1}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ol>
          <p className="service-steps-note"><strong>Alur pemeriksaan:</strong> Domisili, SKTM, dan KTP/KK diperiksa Ketua RT, Ketua RW, petugas desa, lalu Kepala Desa. SKU langsung ke kantor desa tanpa pemeriksaan RT/RW.</p>
        </section>
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
