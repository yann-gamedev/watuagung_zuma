import type { Metadata } from "next";
import { PageHeading, PublicShell } from "@/components/site";

export const metadata: Metadata = {
  title: "BUMDes Watuagung Bangkit",
  description: "BUMDes Watuagung Bangkit berstatus aktif dengan unit usaha peternakan sapi. Penguatan BUMDes direncanakan pada 2027 berdasarkan RKP Desa Watuagung 2027.",
};

export default function BumdesPage() {
  return (
    <PublicShell>
      <PageHeading eyebrow="BUMDES WATUAGUNG" title="BUMDes Watuagung Bangkit" intro="Informasi mengenai badan usaha desa, kegiatan usaha, dan layanan bagi warga." />
      <section className="section container info-page bumdes-page" aria-label="Informasi BUMDES">
        <p className="notice">Sumber: RKP Desa Watuagung 2027, ditetapkan melalui Perdes Nomor 6 Tahun 2026 pada 28 September 2026.</p>
        <div className="bumdes-layout">
          <article className="bumdes-article">
            <h2>Tentang BUMDES</h2>
            <p>BUMDes Watuagung Bangkit berstatus aktif.</p>
            <p>Penguatan BUMDes direncanakan pada 2027.</p>
            <h2>Unit usaha dan layanan</h2>
            <p>Unit usaha yang tercatat adalah peternakan sapi. Halaman ini belum menyediakan pemesanan atau transaksi.</p>
          </article>
          <aside className="bumdes-contact">
            <h2>Kontak BUMDES</h2>
            <p>Alamat kantor, nomor telepon, pengurus, dan jam operasional resmi belum tersedia.</p>
            <p>Informasi akan diperbarui setelah mendapatkan konfirmasi dari pengelola BUMDES.</p>
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}
