import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell, PageHeading } from "@/components/site";
import { ServiceList } from "@/components/service-list";
import { SiteVideo } from "@/components/site-video";
import { HubungiPetugas } from "@/components/hubungi-petugas";
import { pageMeta } from "@/lib/seo";
export const metadata: Metadata = pageMeta({
  title: "Pelayanan Desa",
  description: "Pelayanan surat keterangan Desa Watuagung secara online: pilih layanan, isi formulir, unggah Scan KTP, KK, dan pengantar RT/RW, lalu pantau status pengajuan.",
  path: "/pelayanan/",
});
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
              ["Cek status dan unduh surat", "Kepala desa menyetujui → surat langsung bisa diunduh dan dicetak sendiri. Berlaku 7 hari."],
            ].map(([title, description], index) => (
              <li key={title}>
                <span className="home-step-number" aria-hidden="true">{index + 1}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ol>
          <p className="service-steps-note"><strong>Alur pemeriksaan:</strong> Semua jenis surat diverifikasi petugas desa, lalu disetujui Kepala Desa. Setelah disetujui, surat langsung bisa diunduh dan dicetak sendiri melalui Cek Status Surat. Surat berlaku 7 hari sejak dirilis; keasliannya dapat diperiksa dengan memindai QR pada surat.</p>
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
