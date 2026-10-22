<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>@yield('title')</title>
<style>
    @page { margin: 2cm 2.2cm; }
    body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #000; }
    .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: 18px; }
    .kop p { margin: 0; text-align: center; }
    .kop .nama { font-size: 16pt; font-weight: bold; }
    .judul { text-align: center; margin-bottom: 14px; }
    .judul h1 { font-size: 13pt; text-decoration: underline; margin: 0; }
    .judul p { margin: 0; text-align: center; }
    table.data { margin: 8px 0 8px 24px; border-collapse: collapse; }
    table.data td { padding: 1px 6px; vertical-align: top; }
    table.data td:first-child { width: 170px; padding-left: 0; }
    p { text-align: justify; margin: 6px 0; }
    .ttd { width: 100%; margin-top: 28px; }
    .ttd td { vertical-align: top; }
    .ttd .kanan { width: 46%; text-align: center; }
    .qr img { width: 2.6cm; height: 2.6cm; }
    .qr p { font-size: 8pt; text-align: left; margin: 2px 0; }
    .draf { position: fixed; top: 38%; left: 0; width: 100%; text-align: center; font-size: 110pt; font-weight: bold;
        color: rgba(160, 0, 0, 0.15); transform: rotate(-35deg); z-index: -1; }
</style>
</head>
<body>
@if ($draft)<div class="draf">DRAF</div>@endif
<div class="kop">
    <p>PEMERINTAH KABUPATEN {{ $desa['kabupaten'] }}</p>
    <p>KECAMATAN {{ $desa['kecamatan'] }}</p>
    <p class="nama">PEMERINTAH DESA WATUAGUNG</p>
    <p>{{ $desa['alamat_kantor'] }}</p>
</div>
<div class="judul">
    <h1>@yield('title')</h1>
    <p>Nomor: {{ $number ?? '[NOMOR SURAT]' }}</p>
</div>
<p>Yang bertanda tangan di bawah ini, Kepala Desa Watuagung, Kecamatan {{ $desa['kecamatan'] }}, Kabupaten {{ $desa['kabupaten'] }}, menerangkan bahwa:</p>
<table class="data">
    <tr><td>Nama</td><td>: {{ $a->nama }}</td></tr>
    <tr><td>NIK</td><td>: {{ $a->nik }}</td></tr>
    <tr><td>No. KK</td><td>: {{ $a->no_kk }}</td></tr>
    <tr><td>Tempat, tanggal lahir</td><td>: {{ $a->tempat_lahir }}, {{ $a->tanggal_lahir->locale('id')->translatedFormat('j F Y') }}</td></tr>
    <tr><td>Jenis kelamin</td><td>: {{ $a->jenis_kelamin }}</td></tr>
    <tr><td>Alamat</td><td>: {{ $a->alamat }}, RT {{ $a->rt }} / RW {{ $a->rw }}, Desa Watuagung</td></tr>
</table>
@yield('body')
<p>Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
<table class="ttd"><tr>
    <td class="qr">
        @if ($qr)
            <img src="data:image/png;base64,{{ $qr }}" alt="QR verifikasi">
            <p>Pindai untuk memeriksa keaslian surat.<br>QR bukan tanda tangan elektronik.</p>
        @endif
    </td>
    <td class="kanan">
        <p style="text-align:center">Watuagung, {{ $date->translatedFormat('j F Y') }}<br>Kepala Desa Watuagung</p>
        <br><br><br>
        <p style="text-align:center"><strong><u>{{ $desa['kepala_desa'] }}</u></strong></p>
    </td>
</tr></table>
{{-- ponytail: hapus baris ini setelah template resmi desa diterapkan. --}}
<p style="position: fixed; bottom: -1cm; font-size: 8pt; color: #555">Format sementara, menunggu template resmi Desa Watuagung.</p>
</body>
</html>
