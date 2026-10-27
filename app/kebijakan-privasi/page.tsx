import { PageHeading, PublicShell } from "@/components/site";
import { pages } from "@/lib/data";

export const metadata = {
  title: "Kebijakan Privasi",
  description: "Informasi pengolahan data warga untuk permohonan surat di Desa Watuagung.",
};

const blocks = [
  {
    title: "Pengelola data",
    text: `Data dikelola oleh Pemerintah Desa Watuagung.\nAlamat kantor: ${pages.kontak.blocks[0].text}.`,
  },
  {
    title: "Data yang dikumpulkan",
    text: "Jenis surat dan keperluan surat.\nNama lengkap, NIK, nomor KK, tempat lahir, tanggal lahir, dan jenis kelamin.\nAlamat lengkap, RT, RW, dan nomor telepon.\nKhusus surat keterangan usaha: nama usaha, jenis usaha, dan alamat usaha.",
  },
  {
    title: "Tujuan pengolahan",
    text: "Data digunakan hanya untuk memproses permohonan surat. Data tidak digunakan untuk tujuan lain. Pengolahan dilakukan sesuai peraturan perlindungan data pribadi yang berlaku.\nPada mode simulasi, data identitas tidak disimpan atau dikirim ke pemerintah desa. Gunakan data fiktif saat mencoba.",
  },
  {
    title: "Siapa yang dapat melihat",
    text: "Petugas desa, kepala desa, dan admin dapat melihat data untuk menangani permohonan. Ketua RT dan Ketua RW hanya dapat melihat permohonan di wilayahnya. Setiap pembukaan data dicatat.",
  },
  {
    title: "Keamanan data",
    text: "NIK, nomor KK, nomor telepon, alamat, tempat lahir, dan tanggal lahir disimpan terenkripsi. Kode akses hanya disimpan dalam bentuk hash, bukan sebagai kode asli. Jangan bagikan kode akses Anda kepada orang lain.",
  },
  {
    title: "Masa simpan",
    text: "[MASA SIMPAN — menunggu keputusan desa]",
  },
  {
    title: "Hak warga dan kontak",
    text: "Anda dapat meminta informasi, perbaikan, atau penghapusan data melalui kantor desa.\nTelepon: [NOMOR TELEPON KANTOR DESA]\nEmail: [EMAIL KANTOR DESA]",
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
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
