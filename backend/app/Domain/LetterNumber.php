<?php

namespace App\Domain;

use App\Models\Application;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LetterNumber
{
    /** Call first inside the status transaction, before reading application or counter. */
    public static function acquireWriteLock(int $year): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // ponytail: SQLite serializes writers database-wide; use row locks on PostgreSQL/MySQL when scaling.
            // SQLite ignores FOR UPDATE. Even an empty UPDATE acquires its write lock.
            DB::table('letter_number_counters')->where('year', $year)->update(['year' => $year]);
        }
    }

    /** The caller owns the transaction and application lock; failures roll back the whole transition. */
    public static function issue(Application $application, User $user, Carbon $issuedAt): void
    {
        $year = $issuedAt->year;
        // Upsert acquires a row lock even when two requests create the same year's counter.
        DB::table('letter_number_counters')->upsert([['year' => $year, 'sequence' => 0]], ['year'], ['year']);
        $counter = DB::table('letter_number_counters')->where('year', $year)->lockForUpdate()->first();
        $sequence = $counter->sequence + 1;
        DB::table('letter_number_counters')->where('year', $year)->update(['sequence' => $sequence]);
        $number = strtr(config('letters.format'), [
            '{kode_klasifikasi}' => config('letters.kode_klasifikasi.'.$application->jenis_surat),
            '{urut}' => (string) $sequence,
            '{kode_desa}' => config('letters.kode_desa'),
            '{bulan_romawi}' => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][$issuedAt->month - 1],
            '{tahun}' => (string) $year,
        ]);
        DB::table('letter_numbers')->insert([
            'application_id' => $application->id, 'year' => $year, 'sequence' => $sequence,
            'number' => $number, 'status' => 'issued', 'issued_by' => $user->id, 'issued_at' => $issuedAt,
        ]);
    }

    public static function void(Application $application, string $reason): void
    {
        DB::table('letter_numbers')->where('application_id', $application->id)->where('status', 'issued')
            ->update(['status' => 'void', 'void_reason' => $reason]);
    }
}
