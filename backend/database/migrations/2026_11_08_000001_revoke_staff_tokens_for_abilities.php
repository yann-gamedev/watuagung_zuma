<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Ability token dipecah per peran (panel, applications:manage, media:manage, site:manage).
 * Token lama hanya punya applications:manage sehingga /me menolak 403; cabut semua agar
 * petugas mendapat 401 dan langsung diarahkan ke layar login.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('personal_access_tokens')->delete();
    }

    public function down(): void
    {
        // Token yang dicabut tidak dapat dipulihkan; petugas cukup login ulang.
    }
};
