<x-mail::message>
# Permohonan menunggu persetujuan Anda

**Nomor pengajuan:** {{ $requestId }}<br>
**Jenis surat:** {{ $letterType }}<br>
**Nama pemohon:** {{ $applicantName }}<br>
**Tanggal pengajuan:** {{ $submittedAt }}<br>
**Diverifikasi oleh:** {{ $verifierName ?? '-' }}<br>
@if ($letterNumber)
**Nomor surat:** {{ $letterNumber }}<br>
@endif

<x-mail::button :url="$reviewUrl">
Tinjau dan putuskan
</x-mail::button>

Pilihan cepat (tetap membuka halaman konfirmasi yang sama, belum memutuskan apa pun):
[Setuju]({{ $approveUrl }}) · [Tolak]({{ $rejectUrl }})

Bila Anda setuju, surat ber-QR langsung dirilis dan dapat diunduh serta dicetak sendiri oleh pemohon. Surat berlaku 7 hari sejak dirilis.

Keputusan baru tersimpan setelah Anda memasukkan **PIN persetujuan** di halaman tersebut. Tautan berlaku sekali sampai {{ $expiresAt }} WIB dan tidak berlaku lagi bila status permohonan berubah di panel.

**Jangan teruskan email ini.** Bila tidak dapat membuka tautan, putuskan lewat panel admin.

Salam,<br>
{{ config('mail.from.name') }}
</x-mail::message>
