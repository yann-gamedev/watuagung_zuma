@extends('letters.layout')
@section('title', $title)
@section('body')
<p><strong>KETERANGAN :</strong></p>
<table class="keterangan">
    <tr><td class="urut">1.</td><td>Orang tersebut diatas adalah benar-benar penduduk Desa Watuagung Kecamatan Prigen Kabupaten Pasuruan.</td></tr>
</table>
<p>Yang bersangkutan telah kehilangan : <strong>{{ $a->barang_hilang }}</strong>.</p>
@endsection
