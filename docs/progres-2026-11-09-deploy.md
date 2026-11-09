# Progres 9 November 2026 — berkas deploy VPS

## Lingkup dan keputusan

- Branch `chore/deploy-scripts`; paket konfigurasi/prosedur deploy, bukan perubahan kode aplikasi atau deploy server.
- `backend/.env.production.example`: seluruh 23 kunci `.env.example` dipertahankan; ditambah koneksi PostgreSQL, level log, URL media dan disk privat. Kunci/kredensial kosong, komentar setiap nilai.
- `.env.production.example`: empat nama `NEXT_PUBLIC_*` persis sesuai pembaca kode.
- `deploy/`: deploy in-place fail-fast, smoke test HTTPS, pemeriksaan stub lokal, bootstrap manusia, cron dan README. `deploy/.gitattributes` menjaga skrip/crontab tetap LF saat checkout Windows. Tidak ada dependensi baru.
- Pengguna menyetujui rencana >3 file, lalu memilih spesifikasi terbaru `MEDIA_URL` kosong (`APP_URL/storage`) menggantikan rencana lama `/media`. README mensyaratkan alias Nginx terbatas ke media publik; konfigurasi Nginx tidak dibuat pada sesi ini.
- `APP_KEY` hanya dibuat manusia sekali saat bootstrap sebelum deploy rutin/akses publik, tidak dibuat oleh skrip. Bootstrap tidak boleh mengubah kunci instalasi lama.
- Contoh env di-stage secara eksplisit dengan `git add -f` karena pola `.env*` diabaikan; aturan ignore tidak dilonggarkan untuk env rahasia.

## Verifikasi lokal

- PHP CLI 8.5.12, Composer 2.8.12 tersedia. Tidak memasang Laravel Boost: bukan perubahan aplikasi dan dependensi baru tidak disetujui.
- `npm run lint`: lulus.
- `npx tsc --noEmit`: lulus.
- `NEXT_PUBLIC_SHOW_SAMPLE_CONTENT=false NEXT_PUBLIC_DEMO_MODE=false NEXT_PUBLIC_API_URL=https://deploy-check.example.invalid/api/v1 NEXT_PUBLIC_COMPLAINT_FORM_URL= npm run build`: lulus, 52 halaman statis. Domain `.invalid` sengaja untuk pemeriksaan lokal, bukan artefak yang boleh diunggah. Build membaca `.env.local`, tetapi empat variabel proses di atas menimpa konfigurasi publik terkait. Tidak mengubah env lokal.
- Peringatan build: `package-lock.json` di `C:\Users\Christian` diabaikan karena di luar repo. Build tetap berhasil; tidak mengubah konfigurasi di luar lingkup.
- Git Bash: `bash -n` setiap skrip di `deploy/*.sh` dan `scripts/*.sh`: lulus.
- `bash deploy/test-scripts.sh`: lulus. Mencakup HTTP sukses; 9 kegagalan (jaringan, JSON rusak, stack trace, path Unix, path Windows, env terbuka, Content-Type salah, HSTS hilang, nosniff hilang); domain tidak valid; kegagalan fetch menghentikan deploy sebelum Composer/migration/reload.
- ShellCheck tidak tersedia (`command -v shellcheck` exit 1), tidak dipasang.
- `php artisan test` pada PHP 8.5.12: **gagal**, 408 tes, 371 lulus, 14 failure, 19 error, 4 skipped, 6.109 assertion. Seluruh failure/error terkait pemrosesan gambar: `Call to undefined function App\\Support\\imagejpeg()` / `imagejpeg function is not defined and image cannot be generated.` Pemeriksaan PHP memastikan `gd=true`, tetapi `imagejpeg=false` dan `imagewebp=false`. Tidak mengubah aplikasi atau memasang runtime lain di sesi ini; perlu PHP/GD dengan dukungan JPEG/WebP untuk verifikasi ulang.
- Pemeriksaan assert Node: seluruh 23 kunci backend ada, nilai produksi sesuai spesifikasi, rahasia kosong, 4 nama env frontend identik dengan pembaca kode, komentar setiap nilai: lulus.
- Review tambahan: fetch memakai `--prune-tags` agar tag yang dicabut di origin tidak tetap terpilih dari checkout server; panduan izin menambah default ACL direktori runtime agar file baru PHP-FPM/cron tetap dapat ditulis grup bersama.
- `git diff --cached --check`: lulus setelah cuplikan laporan dibersihkan dari whitespace akhir.
- Pemeriksaan isi 10 file staged: tidak ditemukan pola private key, token GitHub/AWS, atau `APP_KEY` terisi; semua skrip dan crontab LF. Pemeriksaan pola bukan pemindai rahasia menyeluruh; file env contoh diperiksa dengan assertion nilai rahasia kosong.

## Batas bukti

Tidak menjalankan deploy, migration produksi, reload FPM, SSH, DNS, atau smoke test terhadap VPS/domain nyata. Pemeriksaan stub bukan bukti server produksi benar. Tidak memeriksa visual 390px/1440px: tidak ada perubahan UI. Retensi/backup/izin Nginx dan PHP-FPM tetap harus diverifikasi manusia sebelum data warga nyata diterima. Tidak menyatakan M8 siap operasional.

## Grep seluruh `out/` produksi

Pola case-sensitive: `contoh|Contoh|PLACEHOLDER|prototipe|dummy`. Pencarian seluruh file (termasuk JS dan payload React), bukan hanya teks yang tampil. Hasil **112 kecocokan pada 46 file**: `Contoh` 50, `contoh` 33, `PLACEHOLDER` 29; `prototipe` dan `dummy` 0. Teks tidak diperbaiki pada sesi ini.

Daftar di bawah mencatat setiap lokasi cocok (file + nomor baris + offset karakter 1-based), kata cocok, dan cuplikan mentah sebelum/sesudahnya. Escape/markup/minifikasi tetap dipertahankan. Payload HTML/React dapat mengulang konten yang sama; bundle berisi string validasi, petunjuk isian dan cadangan data, tidak semuanya konten contoh yang terlihat. Cuplikan dipotong hanya di luar konteks kecocokan.

### `out/_next/static/chunks/02ln0q6oostdr.js`

- Baris 1, kolom 69442; **Contoh**

```text
hood_approval:!1,jenis_surat:e.endsWith("000007")?"SKTM":"DOMISILI",catatan:"NEED_REVISION"===r[e]?"Contoh: dusun dan alamat perlu dilengkapi.":"REJECTED"===r[e]?"Contoh: pengajuan tidak memenuhi persyaratan.":void 0};throw Error("Nomor pengajuan tidak ditemukan. Periksa kemb
```

- Baris 1, kolom 69505; **Contoh**

```text
ILI",catatan:"NEED_REVISION"===r[e]?"Contoh: dusun dan alamat perlu dilengkapi.":"REJECTED"===r[e]?"Contoh: pengajuan tidak memenuhi persyaratan.":void 0};throw Error("Nomor pengajuan tidak ditemukan. Periksa kembali nomor Anda.")}}],22774)}]);
```

### `out/_next/static/chunks/04x_28n5w6e3d.js`

- Baris 1, kolom 3713; **contoh**

```text
a.jsxs)("details",{className:"lookup-examples",children:[(0,a.jsx)("summary",{children:"Lihat nomor contoh untuk mencoba status"}),(0,a.jsxs)("ul",{children:[(0,a.jsx)("li",{children:"REQ-2026-000001 — Diproses"}),(0,a.jsx)("li",{children:"REQ-2026-000002 — Perlu perbaikan"})
```

- Baris 1, kolom 4171; **contoh**

```text
("li",{children:"REQ-2026-000006 — Selesai"}),(0,a.jsx)("li",{children:"REQ-2026-000007 — Diterima (contoh SKTM)"}),(0,a.jsx)("li",{children:"REQ-2026-000008 — Diverifikasi (contoh domisili)"})]})]})]}),b&&(0,a.jsxs)("div",{id:"lookup-error",className:"error-box",role:"alert"
```

- Baris 1, kolom 4245; **contoh**

```text
Q-2026-000007 — Diterima (contoh SKTM)"}),(0,a.jsx)("li",{children:"REQ-2026-000008 — Diverifikasi (contoh domisili)"})]})]})]}),b&&(0,a.jsxs)("div",{id:"lookup-error",className:"error-box",role:"alert",children:[(0,a.jsx)(u.CircleAlert,{size:24,"aria-hidden":"true"}),(0,a.js
```

- Baris 1, kolom 5408; **PLACEHOLDER**

```text
t"}),(0,a.jsx)("p",{className:"receipt-value",children:x.letter_number}),x.letter_number.includes("[PLACEHOLDER]")&&(0,a.jsx)("p",{children:"Format nomor masih sementara, menunggu ketentuan resmi desa."})]}),f?(0,a.jsxs)("div",{className:"status-exception status-"+x.status,childre
```

### `out/_next/static/chunks/0lqez2upcawgs.js`

- Baris 1, kolom 4850; **PLACEHOLDER**

```text
ary,role:"status",children:[u.total," nomor surat ditemukan."]}),u.data.some(e=>e.number.includes("[PLACEHOLDER]"))&&(0,a.jsx)("p",{className:m.default.message,children:"Format nomor masih sementara, menunggu ketentuan resmi desa."}),0===u.data.length?(0,a.jsx)("p",{className:m.de
```

### `out/_next/static/chunks/0pn8zqrrgk1l0.js`

- Baris 1, kolom 1035; **Contoh**

```text
ge:s("address")}),(0,a.jsx)(n.Field,{path:"hours",label:"Jam pelayanan",value:e.hours,max:200,hint:"Contoh: Hari kerja, 08.00–13.00 WIB. Tulis nama hari hanya bila sudah dipastikan.",onChange:s("hours")}),(0,a.jsx)(n.Field,{path:"contactName",label:"Nama kontak",value:e.conta
```

- Baris 1, kolom 1449; **contoh**

```text
,{path:"phone",label:"Nomor",value:e.phone,max:15,optional:!0,inputMode:"numeric",hint:"Format 62…, contoh 6281234567890. Hanya angka, tanpa +, spasi, atau tanda hubung. Nomor ini dipakai untuk telepon dan WhatsApp; jangan isi nomor rekaan.",onChange:s("phone")}),(0,a.jsx)(n.
```

- Baris 1, kolom 12656; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,s),p=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),h=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 12809; **PLACEHOLDER**

```text
sWith(e)),a),h=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:p(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 12879; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:p(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 14871; **contoh**

```text
)}).strict().nullable(),x=a.z.object({profile:y,tutorial:y}).strict(),v="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",S=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/0s74tcy7acqzv.js`

- Baris 1, kolom 18185; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,s),h=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 18338; **PLACEHOLDER**

```text
sWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 18408; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 20400; **contoh**

```text
)}).strict().nullable(),v=a.z.object({profile:x,tutorial:x}).strict(),P="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",w=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/13plfqvzb9pql.js`

- Baris 1, kolom 60809; **PLACEHOLDER**

```text
className:nL.default.multiline,children:["Alasan pembatalan: ",e.void_reason]}),e.number.includes("[PLACEHOLDER]")&&(0,u.jsx)("dd",{children:"Format sementara, menunggu ketentuan resmi desa."})]},e.number))}):(0,u.jsx)("p",{children:"Belum ada nomor surat yang tercatat. Nomor dibe
```

### `out/_next/static/chunks/1kp3dv86evf1r.js`

- Baris 1, kolom 3004; **Contoh**

```text
0-9]{8,13}$/.test(e),"Nomor WhatsApp diawali 62 lalu 8–13 angka, tanpa +, spasi, atau tanda hubung. Contoh 6281234567890.").transform(e=>e||null),consent_public_contact:t.z.boolean(),status:t.z.enum(["draft","published"])});e.s(["businessInputSchema",0,d,"parseBusiness",0,fun
```

- Baris 1, kolom 11536; **contoh**

```text
ldren:"Nomor WhatsApp (opsional)"}),(0,a.jsx)("span",{id:"umkm-whatsapp-help",children:"Format 62…, contoh 6281234567890. Hanya angka, tanpa +, spasi, atau tanda hubung."}),(0,a.jsx)("input",{id:"umkm-whatsapp",inputMode:"numeric",maxLength:15,"aria-describedby":"umkm-whatsap
```

### `out/_next/static/chunks/1n5tmw0l8v9xw.js`

- Baris 1, kolom 18775; **PLACEHOLDER**

```text
ruan, Jawa Timur",hours:"Hari kerja, 08.00–13.00 WIB",contactName:"Pelayanan Desa (Bu Ita)",phone:"[PLACEHOLDER]",mapsEmbedUrl:"[PLACEHOLDER]",mapsLinkUrl:"[PLACEHOLDER]"},n={profil:{title:"Mengenal Desa Watuagung",eyebrow:"PROFIL DESA",intro:"Rumah bagi semangat gotong royong, al
```

- Baris 1, kolom 18804; **PLACEHOLDER**

```text
 kerja, 08.00–13.00 WIB",contactName:"Pelayanan Desa (Bu Ita)",phone:"[PLACEHOLDER]",mapsEmbedUrl:"[PLACEHOLDER]",mapsLinkUrl:"[PLACEHOLDER]"},n={profil:{title:"Mengenal Desa Watuagung",eyebrow:"PROFIL DESA",intro:"Rumah bagi semangat gotong royong, alam yang lestari, dan masyarak
```

- Baris 1, kolom 18832; **PLACEHOLDER**

```text
tactName:"Pelayanan Desa (Bu Ita)",phone:"[PLACEHOLDER]",mapsEmbedUrl:"[PLACEHOLDER]",mapsLinkUrl:"[PLACEHOLDER]"},n={profil:{title:"Mengenal Desa Watuagung",eyebrow:"PROFIL DESA",intro:"Rumah bagi semangat gotong royong, alam yang lestari, dan masyarakat yang terus bertumbuh.",pr
```

- Baris 1, kolom 36068; **PLACEHOLDER**

```text
ng().max(a,`Maksimal ${a} karakter.`).regex(/^[^\p{Cc}]*$/u,s),h=(a,e)=>c(2048).refine(e=>""===e||"[PLACEHOLDER]"===e||URL.canParse(e)&&a.some(a=>e.startsWith(a)),e),g=e.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:c(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 36221; **PLACEHOLDER**

```text
sWith(a)),e),g=e.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:c(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 36291; **contoh**

```text
60),phone:c(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 38283; **contoh**

```text
)}).strict().nullable(),P=e.z.object({profile:x,tutorial:x}).strict(),D="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",w=e.z.preprocess(a=>a&&"object"==typeof a&&Object.values(a).every(a=>""===a)?null:a,e.z.object({url:e.z.strin
```

### `out/_next/static/chunks/1x-u516cdfuwn.js`

- Baris 1, kolom 1791; **contoh**

```text
)]},e.slug))}),o.data.some(e=>e.sample)&&(0,a.jsx)("p",{className:"home-news-note",children:"Konten contoh untuk pratinjau website."})]}):(0,a.jsxs)("section",{className:"section container news-page","aria-busy":u,children:[o?.data.length?(0,a.jsxs)(a.Fragment,{children:[(0,a
```

- Baris 1, kolom 2364; **contoh**

```text
a.jsxs)("div",{className:"notice news-sample-notice",children:[(0,a.jsx)("strong",{children:"Konten contoh"}),(0,a.jsx)("span",{children:"Seluruh berita di halaman ini adalah materi ilustrasi untuk pratinjau desain, bukan informasi resmi yang telah diverifikasi."})]}),(0,a.js
```

### `out/_next/static/chunks/1x6s5d--eqnji.js`

- Baris 1, kolom 22092; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,n),h=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 22245; **PLACEHOLDER**

```text
sWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 22315; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 24307; **contoh**

```text
)}).strict().nullable(),x=a.z.object({profile:j,tutorial:j}).strict(),P="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",v=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/2__khzxdtdtun.js`

- Baris 1, kolom 10633; **Contoh**

```text
ldren:[(0,a.jsx)(l.Field,{path:`${T}.revenue.${t}.label`,label:"Uraian",value:e.label,max:160,hint:"Contoh: Dana Desa, Alokasi Dana Desa, Pendapatan Asli Desa.",onChange:a=>n({...e,label:a})}),(0,a.jsx)(b,{path:`${T}.revenue.${t}.amount`,label:"Jumlah",value:e.amount,onChange
```

- Baris 1, kolom 11562; **Contoh**

```text
jsx)(l.Field,{path:`${T}.financing.${t}.label`,label:"Uraian",value:e.label,max:160,hint:"Opsional. Contoh: SiLPA tahun sebelumnya.",onChange:a=>n({...e,label:a})}),(0,a.jsx)(b,{path:`${T}.financing.${t}.amount`,label:"Jumlah",value:e.amount,onChange:a=>n({...e,amount:a})})]}
```

- Baris 1, kolom 11950; **Contoh**

```text
.abs(B.surplus)}),(0,a.jsx)(l.Field,{path:`${T}.source`,label:"Sumber",value:$.source,max:1e3,hint:"Contoh: Perdes Nomor … Tahun … tentang APBDes.",onChange:e=>E({source:e})}),(0,a.jsxs)("div",{className:o.default.field,children:[(0,a.jsx)("label",{htmlFor:A,children:"Dokumen
```

- Baris 1, kolom 18249; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,r),h=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 18402; **PLACEHOLDER**

```text
sWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 18472; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 20464; **contoh**

```text
)}).strict().nullable(),v=a.z.object({profile:k,tutorial:k}).strict(),w="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",S=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/2049omoerj_ic.js`

- Baris 1, kolom 3330; **contoh**

```text
xs)("div",{className:"notice article-sample-notice",children:[(0,a.jsx)("strong",{children:"Artikel contoh"}),(0,a.jsx)("span",{children:"Konten ilustrasi untuk pratinjau website. Bukan laporan kegiatan resmi dan belum diverifikasi."})]}),d&&(0,a.jsxs)("figure",{className:"ar
```

- Baris 1, kolom 4151; **contoh**

```text
children:e},t))}),n&&(0,a.jsx)("div",{className:"article-endnote",children:"Informasi dalam artikel contoh ini perlu dikonfirmasi melalui kanal resmi desa."}),l]})}var l=e.i(25158),d=e.i(31833),u=e.i(5664),o=e.i(33324),c=e.i(41863),m=e.i(69009);let p={title:"",category:"kegia
```

### `out/_next/static/chunks/25-qmbi7s7zbr.js`

- Baris 1, kolom 3490; **contoh**

```text
)]},e.slug))}),c.data.some(e=>e.sample)&&(0,a.jsx)("p",{className:"home-news-note",children:"Konten contoh untuk pratinjau website."})]}):(0,a.jsxs)("section",{className:"section container news-page","aria-busy":d,children:[c?.data.length?(0,a.jsxs)(a.Fragment,{children:[(0,a
```

- Baris 1, kolom 4063; **contoh**

```text
a.jsxs)("div",{className:"notice news-sample-notice",children:[(0,a.jsx)("strong",{children:"Konten contoh"}),(0,a.jsx)("span",{children:"Seluruh berita di halaman ini adalah materi ilustrasi untuk pratinjau desain, bukan informasi resmi yang telah diverifikasi."})]}),(0,a.js
```

### `out/_next/static/chunks/261uwlx-uub78.js`

- Baris 1, kolom 14169; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,r),p=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),h=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 14322; **PLACEHOLDER**

```text
sWith(e)),a),h=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:p(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 14392; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:p(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 16384; **contoh**

```text
)}).strict().nullable(),v=a.z.object({profile:y,tutorial:y}).strict(),w="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",$=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/26k2vrbvxfnik.js`

- Baris 1, kolom 10668; **Contoh**

```text
udul video",value:c.title,max:160,optional:!0,hint:"Dibaca pembaca layar dan tampil di bawah video. Contoh: Profil Desa Watuagung.",onChange:e=>m({...c,title:e})}),p?(0,a.jsxs)("div",{children:[(0,a.jsx)("p",{children:"Pratinjau"}),(0,a.jsx)(t.YouTubeEmbed,{youtubeId:p,title:
```

- Baris 1, kolom 13703; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,s),p=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),b=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 13856; **PLACEHOLDER**

```text
sWith(e)),a),b=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:p(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 13926; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:p(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 15918; **contoh**

```text
)}).strict().nullable(),k=a.z.object({profile:w,tutorial:w}).strict(),v="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",S=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/2p1li7mlj9got.js`

- Baris 1, kolom 28961; **PLACEHOLDER**

```text
ruan, Jawa Timur",hours:"Hari kerja, 08.00–13.00 WIB",contactName:"Pelayanan Desa (Bu Ita)",phone:"[PLACEHOLDER]",mapsEmbedUrl:"[PLACEHOLDER]",mapsLinkUrl:"[PLACEHOLDER]"},n={profil:{title:"Mengenal Desa Watuagung",eyebrow:"PROFIL DESA",intro:"Rumah bagi semangat gotong royong, al
```

- Baris 1, kolom 28990; **PLACEHOLDER**

```text
 kerja, 08.00–13.00 WIB",contactName:"Pelayanan Desa (Bu Ita)",phone:"[PLACEHOLDER]",mapsEmbedUrl:"[PLACEHOLDER]",mapsLinkUrl:"[PLACEHOLDER]"},n={profil:{title:"Mengenal Desa Watuagung",eyebrow:"PROFIL DESA",intro:"Rumah bagi semangat gotong royong, alam yang lestari, dan masyarak
```

- Baris 1, kolom 29018; **PLACEHOLDER**

```text
tactName:"Pelayanan Desa (Bu Ita)",phone:"[PLACEHOLDER]",mapsEmbedUrl:"[PLACEHOLDER]",mapsLinkUrl:"[PLACEHOLDER]"},n={profil:{title:"Mengenal Desa Watuagung",eyebrow:"PROFIL DESA",intro:"Rumah bagi semangat gotong royong, alam yang lestari, dan masyarakat yang terus bertumbuh.",pr
```

### `out/_next/static/chunks/2sw0okmdsm20j.js`

- Baris 1, kolom 28510; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,r),h=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 28663; **PLACEHOLDER**

```text
sWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 28733; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 30725; **contoh**

```text
)}).strict().nullable(),_=a.z.object({profile:y,tutorial:y}).strict(),v="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",P=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/2vsl09pdj6ix-.js`

- Baris 1, kolom 13953; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,s),p=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),h=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 14106; **PLACEHOLDER**

```text
sWith(e)),a),h=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:p(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 14176; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:p(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 16168; **contoh**

```text
)}).strict().nullable(),w=a.z.object({profile:j,tutorial:j}).strict(),x="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",v=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/306lz1ebdepdq.js`

- Baris 1, kolom 468; **contoh**

```text
sxs)("div",{className:"notice article-sample-notice",children:[(0,a.jsx)("strong",{children:"Konten contoh"}),(0,a.jsx)("span",{children:"Konten ilustrasi untuk pratinjau website. Bukan laporan kegiatan resmi dan belum diverifikasi."})]}),(0,a.jsx)(l.NewsCover,{title:e,url:s,
```

- Baris 1, kolom 956; **contoh**

```text
children:e},t))}),r&&(0,a.jsx)("div",{className:"article-endnote",children:"Informasi dalam artikel contoh ini perlu dikonfirmasi melalui kanal resmi desa."}),c]})}var c=e.i(79973);function u({slug:e}){let[i,l]=(0,t.useState)(null),[d,o]=(0,t.useState)(!!e),[m,h]=(0,t.useStat
```

### `out/_next/static/chunks/37-ql68kkgxua.js`

- Baris 1, kolom 37928; **Contoh**

```text
,{name:"barang_hilang",label:"Barang atau dokumen yang hilang",type:"textarea",wide:!0,placeholder:"Contoh: KTP",register:b,errors:N}),"UMUM"===e&&(0,r.jsx)(eS,{name:"isi_keterangan",label:"Isi keterangan",type:"textarea",wide:!0,placeholder:"Contoh: Bekerja di Surabaya",hint
```

- Baris 1, kolom 38071; **Contoh**

```text
=e&&(0,r.jsx)(eS,{name:"isi_keterangan",label:"Isi keterangan",type:"textarea",wide:!0,placeholder:"Contoh: Bekerja di Surabaya",hint:"Petugas dapat menyesuaikan kalimat sebelum surat dibuat.",register:b,errors:N}),(0,r.jsx)(eS,{name:"keperluan",label:"UMUM"===e?"Tujuan pengg
```

- Baris 1, kolom 38353; **Contoh**

```text
surat":"KERAMAIAN"===e?"Maksud permohonan":"Keperluan surat",type:"textarea",wide:!0,placeholder:$?`Contoh: ${$.example}`:void 0,hint:["DOMISILI","BELUM_MENIKAH"].includes(e)?"Untuk catatan petugas, tidak dicetak di surat.":void 0,register:b,errors:N})]})]})]}),h&&(0,r.jsxs)(
```

### `out/_next/static/chunks/40pztthi9w3ea.js`

- Baris 1, kolom 13674; **PLACEHOLDER**

```text
ng().max(e,`Maksimal ${e} karakter.`).regex(/^[^\p{Cc}]*$/u,s),h=(e,a)=>m(2048).refine(a=>""===a||"[PLACEHOLDER]"===a||URL.canParse(a)&&e.some(e=>a.startsWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})
```

- Baris 1, kolom 13827; **PLACEHOLDER**

```text
sWith(e)),a),p=a.z.object({address:l(1e3),hours:l(200),contactName:l(160),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https
```

- Baris 1, kolom 13897; **contoh**

```text
60),phone:m(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/,"Gunakan format 62 diikuti angka saja, contoh 6281234567890."),mapsEmbedUrl:h(["https://www.google.com/maps/embed?"],"Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe
```

- Baris 1, kolom 15889; **contoh**

```text
)}).strict().nullable(),w=a.z.object({profile:y,tutorial:y}).strict(),v="Tempel link video YouTube, contoh https://www.youtube.com/watch?v=… atau https://youtu.be/….",S=a.z.preprocess(e=>e&&"object"==typeof e&&Object.values(e).every(e=>""===e)?null:e,a.z.object({url:a.z.strin
```

### `out/_next/static/chunks/43q6enn4di9xk.js`

- Baris 1, kolom 3004; **Contoh**

```text
0-9]{8,13}$/.test(a),"Nomor WhatsApp diawali 62 lalu 8–13 angka, tanpa +, spasi, atau tanda hubung. Contoh 6281234567890.").transform(a=>a||null),consent_public_contact:t.z.boolean(),status:t.z.enum(["draft","published"])});a.s(["businessInputSchema",0,d,"parseBusiness",0,fun
```

### `out/pelayanan/belum-menikah/__next._full.txt`

- Baris 22, kolom 1003; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melengkapi persyaratan pendaftaran kerja."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi d
```

### `out/pelayanan/belum-menikah/__next.pelayanan/$d$service/__PAGE__.txt`

- Baris 20, kolom 1079; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melengkapi persyaratan pendaftaran kerja."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi d
```

### `out/pelayanan/belum-menikah/index.html`

- Baris 1, kolom 10065; **Contoh**

```text
ng>Waktu pelayanan:</strong> <!-- -->menunggu konfirmasi desa</p><p class="service-example"><strong>Contoh keperluan:</strong> <!-- -->Melengkapi persyaratan pendaftaran kerja.</p><p class="service-example">Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan data fikt
```

- Baris 1, kolom 16408; **Contoh**

```text
n" required="" aria-invalid="false" aria-describedby="keperluan-hint" name="keperluan" placeholder="Contoh: Melengkapi persyaratan pendaftaran kerja." maxLength="200"></textarea> <p id="keperluan-hint" class="mt-2">Untuk catatan petugas, tidak dicetak di surat.</p></div></div
```

- Baris 2, kolom 8706; **Contoh**

```text
,\"p\",null,{\"className\":\"service-example\",\"children\":[[\"$\",\"strong\",null,{\"children\":\"Contoh keperluan:\"}],\" \",\"Melengkapi persyaratan pendaftaran kerja.\"]}],[\"$\",\"p\",null,{\"className\":\"service-example\",\"children\":\"Persyaratan ini belum menjadi k
```

### `out/pelayanan/belum-menikah/index.txt`

- Baris 22, kolom 1003; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melengkapi persyaratan pendaftaran kerja."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi d
```

### `out/pelayanan/domisili/__next._full.txt`

- Baris 22, kolom 985; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melengkapi administrasi tempat tinggal."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi des
```

### `out/pelayanan/domisili/__next.pelayanan/$d$service/__PAGE__.txt`

- Baris 20, kolom 1061; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melengkapi administrasi tempat tinggal."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi des
```

### `out/pelayanan/domisili/index.html`

- Baris 1, kolom 10037; **Contoh**

```text
ng>Waktu pelayanan:</strong> <!-- -->menunggu konfirmasi desa</p><p class="service-example"><strong>Contoh keperluan:</strong> <!-- -->Melengkapi administrasi tempat tinggal.</p><p class="service-example">Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan data fiktif
```

- Baris 1, kolom 16378; **Contoh**

```text
n" required="" aria-invalid="false" aria-describedby="keperluan-hint" name="keperluan" placeholder="Contoh: Melengkapi administrasi tempat tinggal." maxLength="200"></textarea> <p id="keperluan-hint" class="mt-2">Untuk catatan petugas, tidak dicetak di surat.</p></div></div><
```

- Baris 2, kolom 8678; **Contoh**

```text
,\"p\",null,{\"className\":\"service-example\",\"children\":[[\"$\",\"strong\",null,{\"children\":\"Contoh keperluan:\"}],\" \",\"Melengkapi administrasi tempat tinggal.\"]}],[\"$\",\"p\",null,{\"className\":\"service-example\",\"children\":\"Persyaratan ini belum menjadi ket
```

### `out/pelayanan/domisili/index.txt`

- Baris 22, kolom 985; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melengkapi administrasi tempat tinggal."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi des
```

### `out/pelayanan/kehilangan/__next._full.txt`

- Baris 22, kolom 999; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melaporkan kehilangan KTP."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan da
```

### `out/pelayanan/kehilangan/__next.pelayanan/$d$service/__PAGE__.txt`

- Baris 20, kolom 1075; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melaporkan kehilangan KTP."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan da
```

### `out/pelayanan/kehilangan/index.html`

- Baris 1, kolom 10055; **Contoh**

```text
ng>Waktu pelayanan:</strong> <!-- -->menunggu konfirmasi desa</p><p class="service-example"><strong>Contoh keperluan:</strong> <!-- -->Melaporkan kehilangan KTP.</p><p class="service-example">Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan data fiktif saat mencoba
```

- Baris 1, kolom 16377; **Contoh**

```text
bel><textarea id="barang_hilang" required="" aria-invalid="false" name="barang_hilang" placeholder="Contoh: KTP" maxLength="200"></textarea> </div><div class="field wide"><label for="keperluan">Keperluan surat<!-- --> <span aria-hidden="true">*</span></label><textarea id="kep
```

- Baris 1, kolom 16624; **Contoh**

```text
pan></label><textarea id="keperluan" required="" aria-invalid="false" name="keperluan" placeholder="Contoh: Melaporkan kehilangan KTP." maxLength="200"></textarea> </div></div></fieldset></div><div class="form-footer"><button class="btn application-submit" type="submit"><svg
```

- Baris 2, kolom 8696; **Contoh**

```text
,\"p\",null,{\"className\":\"service-example\",\"children\":[[\"$\",\"strong\",null,{\"children\":\"Contoh keperluan:\"}],\" \",\"Melaporkan kehilangan KTP.\"]}],[\"$\",\"p\",null,{\"className\":\"service-example\",\"children\":\"Persyaratan ini belum menjadi ketentuan resmi
```

### `out/pelayanan/kehilangan/index.txt`

- Baris 22, kolom 999; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Melaporkan kehilangan KTP."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan da
```

### `out/pelayanan/keramaian/__next._full.txt`

- Baris 22, kolom 1026; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Permohonan izin acara pernikahan."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gun
```

### `out/pelayanan/keramaian/__next.pelayanan/$d$service/__PAGE__.txt`

- Baris 20, kolom 1102; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Permohonan izin acara pernikahan."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gun
```

### `out/pelayanan/keramaian/index.html`

- Baris 1, kolom 10090; **Contoh**

```text
ng>Waktu pelayanan:</strong> <!-- -->menunggu konfirmasi desa</p><p class="service-example"><strong>Contoh keperluan:</strong> <!-- -->Permohonan izin acara pernikahan.</p><p class="service-example">Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan data fiktif saat
```

- Baris 1, kolom 15317; **Contoh**

```text
pan></label><textarea id="keperluan" required="" aria-invalid="false" name="keperluan" placeholder="Contoh: Permohonan izin acara pernikahan." maxLength="200"></textarea> </div></div></fieldset></div><div class="form-footer"><button class="btn application-submit" type="submit
```

- Baris 2, kolom 8721; **Contoh**

```text
,\"p\",null,{\"className\":\"service-example\",\"children\":[[\"$\",\"strong\",null,{\"children\":\"Contoh keperluan:\"}],\" \",\"Permohonan izin acara pernikahan.\"]}],[\"$\",\"p\",null,{\"className\":\"service-example\",\"children\":\"Persyaratan ini belum menjadi ketentuan
```

### `out/pelayanan/keramaian/index.txt`

- Baris 22, kolom 1026; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Permohonan izin acara pernikahan."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gun
```

### `out/pelayanan/sktm/__next._full.txt`

- Baris 22, kolom 1007; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Pendaftaran PIP."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan data fiktif
```

### `out/pelayanan/sktm/__next.pelayanan/$d$service/__PAGE__.txt`

- Baris 20, kolom 1083; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Pendaftaran PIP."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan data fiktif
```

### `out/pelayanan/sktm/index.html`

- Baris 1, kolom 10065; **Contoh**

```text
ng>Waktu pelayanan:</strong> <!-- -->menunggu konfirmasi desa</p><p class="service-example"><strong>Contoh keperluan:</strong> <!-- -->Pendaftaran PIP.</p><p class="service-example">Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan data fiktif saat mencoba formulir.
```

- Baris 1, kolom 16349; **Contoh**

```text
pan></label><textarea id="keperluan" required="" aria-invalid="false" name="keperluan" placeholder="Contoh: Pendaftaran PIP." maxLength="200"></textarea> </div></div></fieldset></div><div class="form-footer"><button class="btn application-submit" type="submit"><svg xmlns="htt
```

- Baris 2, kolom 8692; **Contoh**

```text
,\"p\",null,{\"className\":\"service-example\",\"children\":[[\"$\",\"strong\",null,{\"children\":\"Contoh keperluan:\"}],\" \",\"Pendaftaran PIP.\"]}],[\"$\",\"p\",null,{\"className\":\"service-example\",\"children\":\"Persyaratan ini belum menjadi ketentuan resmi desa. Guna
```

### `out/pelayanan/sktm/index.txt`

- Baris 22, kolom 1007; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Pendaftaran PIP."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjadi ketentuan resmi desa. Gunakan data fiktif
```

### `out/pelayanan/umum/__next._full.txt`

- Baris 22, kolom 1009; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Keterangan bekerja di Surabaya untuk administrasi pekerjaan."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjad
```

### `out/pelayanan/umum/__next.pelayanan/$d$service/__PAGE__.txt`

- Baris 20, kolom 1085; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Keterangan bekerja di Surabaya untuk administrasi pekerjaan."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjad
```

### `out/pelayanan/umum/index.html`

- Baris 1, kolom 10043; **Contoh**

```text
ng>Waktu pelayanan:</strong> <!-- -->menunggu konfirmasi desa</p><p class="service-example"><strong>Contoh keperluan:</strong> <!-- -->Keterangan bekerja di Surabaya untuk administrasi pekerjaan.</p><p class="service-example">Persyaratan ini belum menjadi ketentuan resmi desa
```

- Baris 1, kolom 16424; **Contoh**

```text
d="" aria-invalid="false" aria-describedby="isi_keterangan-hint" name="isi_keterangan" placeholder="Contoh: Bekerja di Surabaya" maxLength="500"></textarea> <p id="isi_keterangan-hint" class="mt-2">Petugas dapat menyesuaikan kalimat sebelum surat dibuat.</p></div><div class="
```

- Baris 1, kolom 16796; **Contoh**

```text
pan></label><textarea id="keperluan" required="" aria-invalid="false" name="keperluan" placeholder="Contoh: Keterangan bekerja di Surabaya untuk administrasi pekerjaan." maxLength="200"></textarea> </div></div></fieldset></div><div class="form-footer"><button class="btn appli
```

- Baris 2, kolom 8694; **Contoh**

```text
,\"p\",null,{\"className\":\"service-example\",\"children\":[[\"$\",\"strong\",null,{\"children\":\"Contoh keperluan:\"}],\" \",\"Keterangan bekerja di Surabaya untuk administrasi pekerjaan.\"]}],[\"$\",\"p\",null,{\"className\":\"service-example\",\"children\":\"Persyaratan
```

### `out/pelayanan/umum/index.txt`

- Baris 22, kolom 1009; **Contoh**

```text
i desa"]}],["$","p",null,{"className":"service-example","children":[["$","strong",null,{"children":"Contoh keperluan:"}]," ","Keterangan bekerja di Surabaya untuk administrasi pekerjaan."]}],["$","p",null,{"className":"service-example","children":"Persyaratan ini belum menjad
```
