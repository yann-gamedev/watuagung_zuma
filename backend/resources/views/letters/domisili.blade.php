@extends('letters.layout')
@section('title', $title)
@section('body')
<p><strong>KETERANGAN :</strong></p>
<table class="keterangan">
    <tr><td class="urut">1.</td><td>Orang tersebut diatas adalah benar-benar berdomisili di Dusun {{ $a->dusun ?? '[DUSUN]' }} RT : {{ str_pad($a->rt, 3, '0', STR_PAD_LEFT) }} RW : {{ str_pad($a->rw, 3, '0', STR_PAD_LEFT) }} Desa Watuagung Kecamatan Prigen Kabupaten Pasuruan.</td></tr>
</table>
@endsection
