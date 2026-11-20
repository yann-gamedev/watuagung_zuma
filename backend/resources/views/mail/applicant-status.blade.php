<x-mail::message>
# Status permohonan surat berubah

**Nomor pengajuan:** {{ $requestId }}<br>
**Jenis surat:** {{ $letterType }}<br>
**Status:** {{ $statusLabel }}

{{ $statusLine }}

@if ($note)
**Catatan petugas:**

{{ $note }}
@endif

<x-mail::button :url="$statusUrl">
Cek status
</x-mail::button>

Di halaman cek status, masukkan nomor pengajuan dan kode akses Anda. **Jangan bagikan kode akses Anda** kepada siapa pun, termasuk orang yang mengaku petugas. Petugas desa tidak pernah meminta kode akses lewat email atau pesan.

Email ini dikirim karena Anda mengisi alamat email dan menyetujui pemberitahuan saat mengajukan surat. Bila Anda tidak merasa mengajukan, abaikan email ini.

[Berhenti menerima email untuk permohonan ini]({{ $unsubscribeUrl }})

Salam,<br>
{{ config('mail.from.name') }}
</x-mail::message>
