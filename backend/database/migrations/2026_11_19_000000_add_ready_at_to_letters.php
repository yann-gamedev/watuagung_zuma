<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Saat scan surat bertanda tangan terakhir diunggah; masa unduh warga dihitung dari sini.
        // Di tabel letters karena terikat pada berkas surat (path/source/file_updated_at), bukan data pemohon.
        // Data lama tidak diisi: surat yang diunggah sebelum fitur ini tidak otomatis dapat diunduh warga.
        Schema::table('letters', fn (Blueprint $table) => $table->timestamp('ready_at')->nullable());
    }

    public function down(): void {
        Schema::table('letters', fn (Blueprint $table) => $table->dropColumn('ready_at'));
    }
};
