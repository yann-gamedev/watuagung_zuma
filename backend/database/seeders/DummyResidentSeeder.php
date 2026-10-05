<?php

namespace Database\Seeders;

use App\Models\Resident;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use LogicException;

class DummyResidentSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new LogicException('Data dummy hanya boleh diinisialisasi pada lingkungan local/testing.');
        }

        // Invalid regional prefixes deliberately distinguish fixtures from real NIKs.
        $rows = [
            ['0000000000000001', 'Pemohon Contoh Satu', 'Kota Contoh A', '2000-03-14'],
            ['0000000000000002', 'Pemohon Contoh Dua', 'Kota Contoh B', '1995-08-21'],
            ['0000000000000003', 'Pemohon Contoh Tiga', 'Kota Contoh C', '2002-12-05'],
        ];

        DB::transaction(function () use ($rows) {
            foreach ($rows as $index => [$nik, $nama, $tempat, $tanggal]) {
                $reference = 'demo-resident-'.($index + 1);
                $existing = Resident::where('dummy_reference', $reference)->first();
                if ($existing && ! $existing->is_dummy) {
                    throw new LogicException('Referensi dummy sudah digunakan data non-dummy; seeding dibatalkan.');
                }
                Resident::updateOrCreate(['dummy_reference' => $reference], [
                    'nik' => $nik,
                    'nama' => $nama,
                    'tempat_lahir' => $tempat,
                    'tanggal_lahir' => $tanggal,
                    'is_dummy' => true,
                ]);
            }
        });
    }
}
