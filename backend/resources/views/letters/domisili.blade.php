@extends('letters.layout')
@section('title', 'SURAT KETERANGAN DOMISILI')
@section('body')
<p>Orang tersebut benar berdomisili di alamat di atas, wilayah Desa Watuagung, berdasarkan pengantar Ketua RT {{ $a->rt }} / RW {{ $a->rw }}.</p>
<p>Surat keterangan ini diberikan untuk keperluan: {{ $a->keperluan }}.</p>
@endsection
