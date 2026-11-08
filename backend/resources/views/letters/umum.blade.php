@extends('letters.layout')
@section('title', $title)
@section('body')
<p><strong>KETERANGAN :</strong></p>
<table class="keterangan">
    <tr><td class="urut">-</td><td>Menerangkan dengan sebenarnya bahwa orang tersebut diatas benar-benar penduduk Desa Watuagung.</td></tr>
    <tr><td class="urut">-</td><td>{{ $a->isi_keterangan }}</td></tr>
</table>
@endsection
