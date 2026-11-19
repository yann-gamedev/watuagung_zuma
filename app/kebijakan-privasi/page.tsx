import { PageHeading, PublicShell } from "@/components/site";
import Link from "next/link";
import { ContactAddress } from "@/components/office-contact";

export const metadata = {
  title: "Kebijakan Privasi",
  description: "Informasi pengolahan data warga untuk permohonan surat di Desa Watuagung.",
};

const blocks = [
  {
    title: "Pengelola data",
    text: <>Data dikelola oleh Pemerintah Desa Watuagung.{"\n"}Alamat kantor: <ContactAddress />.</>,
  },
  {
    title: "Data yang dikumpulkan",
    text: "Jenis surat dan keperluan surat.\nNama lengkap, NIK, nomor KK, tempat lahir, tanggal lahir, jenis kelamin, dan kewarganegaraan.\nAlamat lengkap, dusun, RT, RW, dan nomor telepon.\nAgama, status perkawinan, pendidikan, dan pekerjaan untuk surat selain Izin Keramaian.\nSesuai jenis surat: barang atau dokumen yang hilang; rincian acara (acara, tempat, tanggal mulai dan selesai, jenis hiburan); atau isi keterangan tentang diri pemohon.\nData pengajuan Surat Keterangan Usaha lama tetap dapat memuat nama usaha, jenis usaha, dan alamat usaha; layanan ini tidak menerima pengajuan online baru.",
  },
  {
    title: "Dokumen persyaratan",
    text: "Scan KTP, Scan Kartu Keluarga, dan Scan Surat Pengantar RT/RW dikumpulkan untuk verifikasi permohonan; disimpan terenkripsi, hanya dilihat petugas desa (termasuk admin pelayanan) dan kepala desa. Sistem menyediakan penghapusan otomatis 30 hari setelah permohonan selesai atau ditolak. Pelaksanaannya membutuhkan penjadwal server dan konfigurasi retensi aktif; penerapan pada server produksi belum diverifikasi. Pada mode simulasi, file hanya diproses di memori browser, tidak disimpan atau dikirim ke mana pun.",
  },
  {
    title: "Tujuan pengolahan",
    text: "Data digunakan hanya untuk memproses permohonan surat. Data tidak digunakan untuk tujuan lain. Pengolahan dilakukan sesuai peraturan perlindungan data pribadi yang berlaku.\nPada mode simulasi, data identitas tidak disimpan atau dikirim ke pemerintah desa. Gunakan data fiktif saat mencoba.",
  },
  {
    title: "Siapa yang dapat melihat",
    text: "Petugas desa, kepala desa, dan admin dapat melihat data untuk menangani permohonan. Semua jenis surat diverifikasi petugas desa lalu disetujui kepala desa. Setiap pembukaan data permohonan dicatat.\nKIM (Media Informasi) hanya mengelola berita dan UMKM, termasuk foto, dan tidak dapat mengakses data pemohon atau pengajuan surat. Untuk mengelola UMKM, KIM dapat melihat nama dan nomor WhatsApp pemilik pada detail panel yang diizinkan. Nama dan nomor tersebut hanya ditampilkan kepada publik bila pemilik sudah mengizinkan.",
  },
  {
    title: "Keamanan data",
    text: "NIK, nomor KK, nomor telepon, alamat, tempat lahir, tanggal lahir, agama, dan status perkawinan disimpan terenkripsi. Kode akses hanya disimpan dalam bentuk hash, bukan sebagai kode asli. Jangan bagikan kode akses Anda kepada orang lain.",
  },
  {
    title: "Unduh surat dan kerahasiaan akses",
    text: "Scan surat bertanda tangan basah dan stempel dapat diunduh dengan nomor pengajuan dan kode akses rahasia selama 30 hari sejak scan surat terakhir diunggah. Unduhan pertama menyelesaikan permohonan; unduhan ulang tetap tersedia selama masa unduh. Setiap unduhan dicatat. Setelah masa unduh berakhir, hubungi petugas desa. Scan surat bukan Tanda Tangan Elektronik tersertifikasi.\nJaga nomor pengajuan dan kode akses di tempat aman. Jangan bagikan kode akses kepada siapa pun, termasuk melalui WhatsApp. Bantuan WhatsApp hanya menyertakan nomor pengajuan, tidak pernah kode akses.",
  },
  {
    title: "Masa simpan",
    text: "[MASA SIMPAN — menunggu keputusan desa]",
  },
  {
    title: "Hak warga dan kontak",
    text: "Anda dapat meminta informasi, perbaikan, atau penghapusan data melalui kantor desa.",
  },
  {
    title: "Pengaduan melalui Google Form",
    text: "Jika Anda menggunakan Google Form untuk pengaduan, data pengaduan disimpan di Google. Penggunaannya tunduk pada kebijakan privasi Google. Jangan menulis NIK atau nomor KK di formulir pengaduan.",
  },
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <PageHeading
        eyebrow="INFORMASI LAYANAN"
        title="Kebijakan Privasi"
        intro="Baca cara data Anda dikelola sebelum mengajukan surat."
      />
      <section className="section container info-page">
        <div className="notice">Terakhir diperbarui: [TANGGAL]</div>
        <div className="content-grid">
          {blocks.map((block) => (
            <article className="content-card" key={block.title}>
              <h2>{block.title}</h2>
              <p>{block.text}</p>
              {block.title === "Hak warga dan kontak" && (
                <Link className="home-bottom-button mt-4" href="/kontak">Kontak kantor desa</Link>
              )}
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
