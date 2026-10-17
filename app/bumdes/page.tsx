import type { Metadata } from "next";
import { PageHeading, PublicShell } from "@/components/site";

export const metadata: Metadata = {
  title: "BUMDES — Badan Usaha Milik Desa",
  description: "Informasi Badan Usaha Milik Desa Watuagung. Profil, unit usaha, dan kontak resmi masih menunggu verifikasi.",
};

export default function BumdesPage() {
  return (
    <PublicShell>
      <PageHeading eyebrow="BUMDES WATUAGUNG" title="Badan Usaha Milik Desa" intro="Informasi mengenai badan usaha desa, kegiatan usaha, dan layanan bagi warga." />
      <section className="section container info-page bumdes-page" aria-label="Informasi BUMDES">
        <p className="notice">Halaman prototipe. Informasi resmi BUMDES belum tersedia dan akan ditampilkan setelah diverifikasi.</p>
        <div className="bumdes-layout">
          <article className="bumdes-article">
            <h2>Tentang BUMDES</h2>
            <p>Badan Usaha Milik Desa merupakan badan usaha yang dibentuk untuk mengelola usaha dan memanfaatkan potensi desa bagi kesejahteraan masyarakat.</p>
            <p>Nama badan usaha, profil organisasi, dan dokumen pendirian BUMDES Watuagung belum dicantumkan karena masih menunggu data resmi.</p>
            <h2>Unit usaha dan layanan</h2>
            <p>Daftar unit usaha, produk, serta layanan belum tersedia. Halaman ini belum menyediakan pemesanan atau transaksi.</p>
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
