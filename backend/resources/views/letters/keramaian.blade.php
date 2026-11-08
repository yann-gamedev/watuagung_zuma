@extends('letters.layout')
@section('title', $title)
@section('personal')
@php
    $mulai = \Illuminate\Support\Carbon::parse($a->tanggal_mulai)->locale('id');
    $selesai = \Illuminate\Support\Carbon::parse($a->tanggal_selesai)->locale('id');
    $hariTanggal = $mulai->translatedFormat('l, d F Y');
    if (! $mulai->isSameDay($selesai)) {
        $formatAwal = $mulai->isSameMonth($selesai) ? 'd' : ($mulai->isSameYear($selesai) ? 'd F' : 'd F Y');
        $hariTanggal = $mulai->translatedFormat('l').'–'.$selesai->translatedFormat('l').', '.$mulai->translatedFormat($formatAwal).'–'.$selesai->translatedFormat('d F Y');
    }
    $alamatAcara = 'Dusun '.$a->dusun.' RT : '.str_pad($a->rt, 3, '0', STR_PAD_LEFT).' RW : '.str_pad($a->rw, 3, '0', STR_PAD_LEFT);
@endphp
<table class="data">
    @foreach ([
        'Nama Lengkap' => $a->nama,
        'Tempat/tgl lahir' => $a->tempat_lahir.', '.\Illuminate\Support\Carbon::parse($a->tanggal_lahir)->format('d-m-Y'),
        'Jenis Kelamin' => $a->jenis_kelamin,
        'Kewarganegaraan' => $a->kewarganegaraan === 'WNI' ? 'Indonesia' : $a->kewarganegaraan,
        'Alamat' => $alamatAcara,
        'Nomor Telepon' => $a->telepon,
        'Maksud' => $a->keperluan,
    ] as $label => $value)
    <tr><td class="urut">{{ chr(97 + $loop->index) }}.</td><td class="label">{{ $label }}</td><td class="titik">:</td><td>{{ $value }}@if ($label === 'Alamat')<br>Desa Watuagung Kecamatan Prigen Kabupaten Pasuruan @endif</td></tr>
    @endforeach
</table>
<p>Nama tersebut diatas Bermaksud Permohonan ijin :</p>
<table class="data">
    <tr><td class="label">Acara</td><td class="titik">:</td><td>{{ $a->acara }}</td></tr>
    <tr><td class="label">Tempat</td><td class="titik">:</td><td>{{ $a->tempat_acara }}</td></tr>
    <tr><td class="label">Hari/Tanggal</td><td class="titik">:</td><td>{{ $hariTanggal }}</td></tr>
    <tr><td class="label">Jenis Hiburan</td><td class="titik">:</td><td>{{ $a->jenis_hiburan }}</td></tr>
</table>
@endsection
@section('closing', 'Demikian atas ijin permohonan ini kami sampaikan dan semoga dapat dipergunakan sebagaimana mestinya.')
