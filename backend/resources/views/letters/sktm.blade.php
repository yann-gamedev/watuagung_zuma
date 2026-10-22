@extends('letters.layout')
@section('title', 'SURAT KETERANGAN TIDAK MAMPU')
@section('body')
<p>Berdasarkan pengantar Ketua RT {{ $a->rt }} / RW {{ $a->rw }}, orang tersebut benar warga Desa Watuagung yang tergolong keluarga tidak mampu.</p>
<p>Surat keterangan ini diberikan untuk keperluan: {{ $a->keperluan }}.</p>
@endsection
