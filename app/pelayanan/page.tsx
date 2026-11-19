import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PageHeading } from "@/components/site";
import { ServiceList } from "@/components/service-list";
import { SiteVideo } from "@/components/site-video";
import { HubungiPetugas } from "@/components/hubungi-petugas";
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
        <SiteVideo slot="tutorial" heading="Video tutorial pengajuan surat" className="site-video-centered" />
        <ServiceList fullRequirements />
        <section className="service-steps" aria-labelledby="service-steps-title">
          <h2 id="service-steps-title">Cara mengajukan surat</h2>
          <ol className="home-steps-list" role="list">
            {[
              ["Pilih layanan surat", "Baca persyaratan surat yang Anda butuhkan."],
              ["Isi dan kirim pengajuan", "Isi formulir, lalu unggah Scan KTP, Scan Kartu Keluarga, dan Scan Surat Pengantar RT/RW."],
              ["Simpan bukti pengajuan", "Simpan nomor pengajuan dan kode akses rahasia untuk mengecek perkembangan surat."],
              ["Cek status dan unduh surat", "Unduh sendiri setelah status Siap diunduh."],
            ].map(([title, description], index) => (
              <li key={title}>
                <span className="home-step-number" aria-hidden="true">{index + 1}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ol>
          <p className="service-steps-note"><strong>Alur pemeriksaan:</strong> Semua jenis surat diverifikasi petugas desa, lalu disetujui Kepala Desa. Kantor mencetak surat untuk ditandatangani basah dan distempel, lalu mengunggah scan surat agar dapat Anda unduh. Setelah status Disetujui, cek lagi dalam 1–2 hari kerja. Masa unduh 30 hari sejak scan surat diunggah.</p>
        </section>
        <HubungiPetugas />
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
