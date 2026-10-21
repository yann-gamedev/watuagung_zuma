@extends('letters.layout')
@section('title', 'SURAT KETERANGAN USAHA')
@section('body')
<p>Berdasarkan pengetahuan dan catatan kami, orang tersebut benar memiliki usaha:</p>
<table class="data">
    <tr><td>Nama usaha</td><td>: {{ $a->nama_usaha }}</td></tr>
    <tr><td>Jenis usaha</td><td>: {{ $a->jenis_usaha }}</td></tr>
    <tr><td>Alamat usaha</td><td>: {{ $a->alamat_usaha }}</td></tr>
</table>
<p>Surat keterangan ini diberikan untuk keperluan: {{ $a->keperluan }}.</p>
@endsection
