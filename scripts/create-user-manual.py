from html import escape
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

OUT = Path("docs/Modul_Panduan_Pengguna_dan_Admin_Watuagung.docx")
OUT.parent.mkdir(parents=True, exist_ok=True)

blocks = []

def p(text="", style="Normal"):
    blocks.append((style, text))

def h(text, level=1):
    p(text, f"Heading{level}")

def bullets(items):
    for item in items:
        p("•  " + item)

p("MODUL PANDUAN PENGGUNA DAN ADMIN", "Title")
p("Sistem Informasi dan Pelayanan Digital Desa Watuagung", "Subtitle")
p("Panduan warga/pemohon dan petugas pengelola", "Subtitle")
p("Versi 1.0 | November 2026", "Subtitle")
h("Tentang modul ini")
p("Modul ini menjelaskan cara menggunakan layanan surat bagi warga serta panel petugas bagi admin dan peran terkait. Nama menu dapat berbeda sedikit mengikuti hak akses akun.")
p("Catatan status: aplikasi masih berupa prototipe. Persyaratan dan waktu pelayanan sementara menunggu konfirmasi desa. Gunakan data fiktif saat uji coba dan jangan masukkan data warga nyata ke lingkungan demo.")
h("Daftar isi")
for item in ["1. Mengenal layanan", "2. Panduan warga/pemohon", "3. Panduan masuk panel", "4. Panduan petugas memproses permohonan", "5. Panduan admin mengelola akun", "6. Berita, UMKM, dan konten situs", "7. Keamanan dan pemecahan masalah"]:
    p(item)

h("1. Mengenal layanan")
p("Portal publik menyediakan informasi desa, layanan administrasi, berita, UMKM, dan cek status. Jenis surat yang tersedia meliputi SKU, domisili, SKTM, pengantar KTP/KK, kehilangan, keramaian, dan surat umum sesuai konfigurasi sistem.")
p("Alur umum pelayanan: warga mengirim permohonan → petugas desa memeriksa → persetujuan mengikuti jenis surat dan pengaturan desa → petugas menyiapkan surat → warga mengambil surat fisik di kantor setelah status siap diambil. Jika persetujuan RT/RW diaktifkan, permohonan yang memerlukannya melewati RT lalu RW sebelum diproses kantor desa.")
p("Alamat halaman: Pelayanan /pelayanan/, cek status /pelayanan/status/, dan panel petugas /admin/. Pada demo lokal tanpa koneksi API, layanan hanya simulasi dan panel petugas tidak tersedia.")

h("2. Panduan warga/pemohon")
h("2.1 Mengirim permohonan", 2)
for i, t in enumerate(["Buka halaman Pelayanan dan pilih jenis surat yang dibutuhkan.", "Baca persyaratan yang ditampilkan. Persyaratan pada prototipe masih sementara; konfirmasikan ke kantor desa sebelum menyiapkan dokumen resmi.", "Isi formulir dengan data yang benar. Jangan mengirim data nyata saat menggunakan demo.", "Tinjau kembali isian, lalu kirim permohonan.", "Pada halaman berhasil, simpan nomor pengajuan dan kode akses rahasia. Kode akses hanya ditampilkan pada sesi tersebut; simpan di tempat aman dan jangan bagikan kepada orang lain."], 1):
    p(f"{i}. {t}")
h("2.2 Mengecek perkembangan", 2)
for i, t in enumerate(["Buka Cek Status Surat (/pelayanan/status/).", "Masukkan nomor pengajuan dan kode akses. Pada mode API keduanya diperlukan.", "Baca status, catatan petugas, dan langkah berikutnya. Jika diminta memperbaiki data, ikuti catatan atau hubungi kantor desa.", "Jika status siap diambil, hubungi atau kunjungi kantor desa sesuai informasi kontak untuk mengambil surat fisik."], 1):
    p(f"{i}. {t}")
p("Jika kode akses hilang, hubungi kantor desa untuk meminta kode baru dengan pemeriksaan identitas sesuai prosedur. Jangan mengirim kode akses melalui grup publik.")
h("2.3 Memahami mode demo", 2)
p("Pada simulasi, bukti/status dapat tersimpan hanya pada browser yang sama dan tidak diproses oleh server. Status simulasi tidak berubah otomatis. Pesan “Panel petugas tidak aktif pada demo” berarti halaman sedang memakai demo, bukan bahwa akun warga atau admin bermasalah.")

h("3. Panduan masuk panel")
for i, t in enumerate(["Buka /admin/ pada alamat situs yang terhubung ke backend.", "Masukkan username akun (bukan nama tampilan atau email) dan kata sandi.", "Saat pertama kali masuk dengan kata sandi sementara, buat kata sandi baru sesuai ketentuan yang ditampilkan.", "Pastikan nama dan peran yang tampil sesuai akun. Gunakan menu Keluar setelah selesai, terutama pada perangkat bersama."], 1):
    p(f"{i}. {t}")
p("Tidak ada pendaftaran mandiri atau kata sandi bawaan. Akun dibuat oleh admin atau dibuat pertama kali oleh pengelola teknis di server.")
h("Hak akses singkat", 2)
bullets(["Admin: mengelola pengajuan sesuai kewenangan kantor, media/konten, dan akun petugas. Persetujuan akhir Kepala Desa tetap dilakukan oleh peran Kepala Desa.", "Petugas (staff): memproses permohonan dan dapat mengelola media serta konten sesuai konfigurasi.", "Kepala Desa: meninjau dan memberi keputusan persetujuan akhir; tidak mengelola akun/media/konten.", "KIM: mengelola berita dan UMKM; tidak dapat membuka data pemohon atau pengajuan.", "Ketua RT/Ketua RW: memeriksa antrean wilayahnya jika fitur persetujuan RT/RW diaktifkan."])

h("4. Panduan petugas memproses permohonan")
for i, t in enumerate(["Masuk ke /admin/ dan buka Dashboard atau menu Permohonan/antrean yang tersedia untuk peran Anda.", "Gunakan pencarian atau filter untuk menemukan permohonan. Buka detail dan periksa jenis surat, informasi yang diperlukan, status, serta riwayat.", "Akses data identitas hanya untuk keperluan pemrosesan. Beberapa data sensitif memerlukan tindakan buka/tampilkan dan akses tersebut dicatat.", "Pilih hanya tindakan status yang disediakan oleh sistem untuk akun Anda. Tambahkan catatan saat menolak atau meminta perbaikan; sistem meminta alasan untuk tindakan tersebut.", "Untuk surat umum, sunting kalimat keterangan bila diperlukan dan simpan sebelum memeriksa draf atau meneruskan proses.", "Setelah persetujuan yang diperlukan, petugas kantor dapat menyiapkan PDF atau mengunggah hasil pindaian PDF sesuai tahap yang diizinkan.", "Tandai surat siap diambil setelah persiapan selesai. Setelah warga mengambilnya, tandai sudah diambil bila tindakan tersebut tersedia.", "Periksa riwayat status agar tindakan dan catatan terakhir tercatat dengan benar."], 1):
    p(f"{i}. {t}")
p("Unggah surat hasil pindaian hanya menerima PDF dengan batas ukuran yang ditampilkan di halaman. Pastikan isi dan tanda tangan/stempel sesuai prosedur desa. PDF otomatis memakai format sementara; QR membantu verifikasi dan bukan tanda tangan elektronik tersertifikasi.")

h("5. Panduan admin mengelola akun")
h("5.1 Membuat akun", 2)
for i, t in enumerate(["Buka menu Akun (/admin/akun/).", "Pilih Tambah akun, lalu isi nama, username, peran, dan wilayah bila diperlukan.", "Buat kata sandi sementara sesuai batas minimal pada formulir. Username menggunakan huruf kecil/angka, tanda hubung atau garis bawah; username tidak dapat diubah setelah dibuat.", "Simpan kata sandi sementara dan serahkan kepada pemilik akun melalui saluran pribadi. Kata sandi sementara ditampilkan sekali.", "Minta pengguna masuk dan mengganti kata sandi sebelum memakai panel."], 1):
    p(f"{i}. {t}")
h("5.2 Merawat akun", 2)
bullets(["Reset kata sandi untuk pengguna yang lupa; sampaikan kata sandi sementara lewat saluran pribadi.", "Nonaktifkan akun yang tidak lagi bertugas. Riwayat tindakan tetap tersimpan dan sesi akun berakhir.", "Aktifkan kembali akun hanya bila pengguna berwenang kembali bertugas.", "Periksa nama, peran, dan wilayah sebelum menyimpan perubahan. Berikan peran paling terbatas yang diperlukan.", "Akun tidak dihapus melalui panel untuk menjaga riwayat kerja. Admin tidak dapat menonaktifkan dirinya sendiri jika itu menghilangkan admin aktif terakhir."])
p("Admin pertama pada instalasi baru dibuat oleh pengelola teknis melalui perintah backend staff:create. Jangan menjalankan perintah pembuatan akun berulang jika akun sudah ada; akun tersimpan di database backend yang sedang dipakai.")

h("6. Berita, UMKM, dan konten situs")
bullets(["Berita: gunakan menu Berita untuk menulis atau menyunting artikel, mengatur status draf/terbit, dan mengelola sampul sesuai kontrol yang tersedia.", "UMKM: gunakan menu UMKM untuk menambah atau memperbarui informasi usaha dan foto. Pastikan pemilik mengizinkan informasi kontak ditampilkan kepada publik.", "Konten situs: gunakan menu Konten untuk bagian profil, sejarah, kontak, transparansi, struktur, dan video yang tersedia bagi peran Anda.", "Tinjau hasil di situs publik setelah penyimpanan. Jangan menulis identitas warga atau dokumen pribadi pada konten publik."])

h("7. Keamanan dan pemecahan masalah")
h("Menjaga keamanan", 2)
bullets(["Gunakan kata sandi unik dan jangan membagikannya. Jangan mengirim kata sandi, token, kode akses, atau file .env ke grup atau tiket umum.", "Kunci perangkat setelah digunakan dan keluar dari panel pada komputer bersama.", "Buka data pemohon hanya untuk menangani permohonan. Hindari menyimpan tangkapan layar atau salinan identitas di perangkat pribadi.", "Gunakan data fiktif pada demo dan pengujian. Prototipe belum siap menerima data warga nyata."])
h("Masalah umum", 2)
bullets(["Panel petugas tidak aktif pada demo: buka mode API, pastikan NEXT_PUBLIC_API_URL mengarah ke backend, NEXT_PUBLIC_DEMO_MODE=false, lalu mulai ulang frontend.", "Server belum dapat dihubungi: pastikan backend berjalan dan halaman /up dapat dibuka; periksa koneksi dan pengaturan CORS.", "Kredensial tidak valid: periksa username (bukan email), kata sandi, status akun aktif, serta database backend yang digunakan.", "Akun lokal tidak ditemukan di komputer/server lain: database tidak ikut berpindah bersama kode. Pastikan backend memakai basis data yang sama saat akun dibuat.", "Tidak melihat menu tertentu: akses panel bergantung pada peran, hak akses, wilayah, dan fitur yang diaktifkan.", "Jika lupa kode akses permohonan: hubungi kantor desa untuk pemeriksaan dan pembuatan kode baru."])
p("Untuk bantuan teknis, sampaikan alamat halaman dan pesan galat tanpa menyertakan kata sandi, kode akses, token, atau data identitas warga.")
p("Akhir modul", "Subtitle")

def run(text):
    return f'<w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r>'

body = []
for style, text in blocks:
    body.append(f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr>{run(text)}</w:p>')
body_xml = "".join(body)
document = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body_xml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>'''
styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:color w:val="315C4B"/><w:sz w:val="36"/></w:rPr><w:pPr><w:jc w:val="center"/><w:spacing w:before="2800" w:after="280"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="60756B"/><w:sz w:val="24"/></w:rPr><w:pPr><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="315C4B"/><w:sz w:val="30"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="180"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="547565"/><w:sz w:val="25"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/></w:pPr></w:style>
</w:styles>'''
with ZipFile(OUT, "w", ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>''')
    z.writestr("_rels/.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>''')
    z.writestr("word/document.xml", document)
    z.writestr("word/styles.xml", styles)
print(OUT.resolve())
