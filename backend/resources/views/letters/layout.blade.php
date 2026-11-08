<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>@yield('title')</title>
<style>
    @page { margin: 1.5cm 2cm; }
    body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.25; color: #000; }
    .kop { border-bottom: 4px double #000; padding-bottom: 6px; margin-bottom: 14px; }
    .kop table { width: 100%; border-collapse: collapse; }
    .kop td { text-align: center; vertical-align: middle; }
    .kop .logo { width: 2.2cm; }
    .kop img { width: 1.8cm; height: auto; }
    .kop p { margin: 0; text-align: center; }
    .kop .nama { font-size: 18pt; font-weight: bold; }
    .kop .alamat { font-size: 10pt; }
    .judul { text-align: center; margin-bottom: 14px; }
    .judul h1 { font-size: 13pt; text-decoration: underline; margin: 0; }
    .judul p { margin: 0; text-align: center; }
    table.data, table.keterangan { width: 100%; margin: 8px 0; border-collapse: collapse; }
    table.data td, table.keterangan td { padding: 2px 0; vertical-align: top; }
    table.data .urut, table.keterangan .urut { width: 24px; }
    table.data .label { width: 140px; }
    table.data .titik { width: 12px; }
    p { text-align: justify; margin: 8px 0; }
    .ttd { width: 100%; margin-top: 18px; border-collapse: collapse; page-break-inside: avoid; }
    .ttd td { width: 50%; vertical-align: top; text-align: center; }
    .ttd p { text-align: center; margin: 0; }
    .ttd .nama { padding-top: 2cm; }
    .ttd .qr { padding-top: 10px; text-align: left; }
    .qr img { width: 2.1cm; height: 2.1cm; }
    .qr p { font-size: 8pt; text-align: left; margin: 2px 0; }
    .draf { position: fixed; top: 38%; left: 0; width: 100%; text-align: center; font-size: 110pt; font-weight: bold;
        color: rgba(160, 0, 0, 0.15); transform: rotate(-35deg); z-index: -1; }
</style>
</head>
<body>
@php
    $rt = str_pad($a->rt ?? '', 3, '0', STR_PAD_LEFT);
    $rw = str_pad($a->rw ?? '', 3, '0', STR_PAD_LEFT);
    $alamat = $a->dusun ? 'Dusun '.$a->dusun.' RT : '.$rt.' RW : '.$rw : $a->alamat.' RT : '.$rt.' RW : '.$rw;
    $wilayah = 'Desa Watuagung Kecamatan '.ucwords(strtolower($desa['kecamatan'])).' Kabupaten '.ucwords(strtolower($desa['kabupaten']));
    $kewarganegaraan = $a->kewarganegaraan === 'WNI' ? 'Indonesia' : ($a->kewarganegaraan ?? '-');
    $duaTandaTangan = in_array($a->jenis_surat, ['KEHILANGAN', 'BELUM_MENIKAH'], true);
@endphp
@if ($draft)<div class="draf">DRAF</div>@endif
<div class="kop">
    <table><tr>
        <td class="logo"><img src="data:image/jpeg;base64,{{ base64_encode(file_get_contents(resource_path('letters/logo-kabupaten-pasuruan.jpg'))) }}" alt="Lambang Kabupaten Pasuruan"></td>
        <td>
            <p>PEMERINTAH KABUPATEN {{ $desa['kabupaten'] }}</p>
            <p>KECAMATAN {{ $desa['kecamatan'] }}</p>
            <p class="nama">KEPALA DESA WATUAGUNG</p>
            <p class="alamat">{{ $desa['alamat_kantor'] }}</p>
        </td>
    </tr></table>
</div>
<div class="judul">
    <h1>@yield('title')</h1>
    <p>Nomor: {{ $number ?? '[NOMOR SURAT]' }}</p>
</div>
<p>Yang bertanda tangan di bawah ini Kepala {{ $wilayah }}, menerangkan dengan sebenarnya bahwa :</p>
@section('personal')
<table class="data">
    @foreach ([
        'Nama' => $a->nama,
        'Jenis Kelamin' => $a->jenis_kelamin,
        'Tempat/Tgl. Lahir' => $a->tempat_lahir.', '.\Illuminate\Support\Carbon::parse($a->tanggal_lahir)->format('d-m-Y'),
        'Agama' => $a->agama ?? '-',
        'Kewarganegaraan' => $kewarganegaraan,
        'Status Perkawinan' => $a->status_perkawinan ?? '-',
        'Pendidikan' => $a->pendidikan ?? '-',
        'Pekerjaan' => $a->pekerjaan ?? '-',
        'Nomor NIK' => $a->nik,
        'Nomor KSK' => $a->no_kk,
        'Alamat' => $alamat,
    ] as $label => $value)
    <tr><td class="urut">{{ $loop->iteration }}.</td><td class="label">{{ $label }}</td><td class="titik">:</td><td>{{ $value }}@if ($label === 'Alamat')<br>{{ $wilayah }}@endif</td></tr>
    @endforeach
</table>
@show
@yield('body')
<p>@yield('closing', 'Demikian Surat Keterangan ini diberikan kepada yang bersangkutan untuk dapat dipergunakan sebagaimana mestinya.')</p>
<table class="ttd">
    <tr>
        <td>@if ($duaTandaTangan)<p><br>Yang bersangkutan</p>@endif</td>
        <td><p>Watuagung, {{ $date->translatedFormat('d F Y') }}<br>Kepala Desa Watuagung</p></td>
    </tr>
    <tr>
        <td class="nama">@if ($duaTandaTangan)<strong><u>{{ $a->nama }}</u></strong>@endif</td>
        <td class="nama"><strong><u>{{ $desa['kepala_desa'] }}</u></strong></td>
    </tr>
    @if ($qr)
    <tr><td class="qr" colspan="2">
        <img src="data:image/png;base64,{{ $qr }}" alt="QR verifikasi">
        <p>Pindai untuk memeriksa keaslian surat.<br>QR bukan tanda tangan elektronik.</p>
    </td></tr>
    @endif
</table>
</body>
</html>
