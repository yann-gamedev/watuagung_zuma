@extends('letters.layout')
{{-- ponytail: template generik sementara untuk jenis baru; diganti template resmi per jenis di S2. --}}
@section('title', $title)
@section('body')
@if ($a->barang_hilang)
<p>Orang tersebut telah kehilangan: <strong>{{ $a->barang_hilang }}</strong>.</p>
@endif
@if ($a->acara)
<table class="data">
    <tr><td>Acara</td><td>: {{ $a->acara }}</td></tr>
    <tr><td>Tempat</td><td>: {{ $a->tempat_acara }}</td></tr>
    <tr><td>Tanggal</td><td>: {{ $a->tanggal_mulai }} s.d. {{ $a->tanggal_selesai }}</td></tr>
    <tr><td>Jenis hiburan</td><td>: {{ $a->jenis_hiburan }}</td></tr>
</table>
@endif
@if ($a->isi_keterangan)
<p>{{ $a->isi_keterangan }}</p>
@endif
<p>Surat keterangan ini diberikan untuk keperluan: {{ $a->keperluan }}.</p>
@endsection
