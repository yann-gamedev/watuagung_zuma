import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PageHeading } from "@/components/site";
import { ServiceList } from "@/components/service-list";
import { SiteVideo } from "@/components/site-video";
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
          Prototipe layanan. Persyaratan sementara dan waktu pelayanan menunggu konfirmasi desa.
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
          <p className="service-steps-note"><strong>Alur pemeriksaan:</strong> Semua jenis surat diverifikasi petugas desa, lalu disetujui Kepala Desa. Surat fisik diambil di kantor desa setelah berstatus siap diambil.</p>
        </section>
        <SiteVideo slot="tutorial" heading="Video tutorial pengajuan surat" />
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
