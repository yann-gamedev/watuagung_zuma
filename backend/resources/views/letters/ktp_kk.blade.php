@extends('letters.layout')
@section('title', 'SURAT PENGANTAR KTP/KK')
@section('body')
<p>Orang tersebut benar warga Desa Watuagung dan bermaksud mengurus dokumen kependudukan (KTP/KK) di Dinas Kependudukan dan Pencatatan Sipil Kabupaten {{ $desa['kabupaten'] }}, berdasarkan pengantar Ketua RT {{ $a->rt }} / RW {{ $a->rw }}.</p>
<p>Keperluan: {{ $a->keperluan }}.</p>
@endsection
