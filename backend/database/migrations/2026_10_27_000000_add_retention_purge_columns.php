<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('applications', fn (Blueprint $table) => $table->timestamp('purged_at')->nullable());
        // File PDF dihapus karena retensi; baris surat tetap untuk verifikasi QR dan register.
        Schema::table('letters', fn (Blueprint $table) => $table->timestamp('file_purged_at')->nullable());
        // null = aksi sistem (perintah terjadwal), bukan akun petugas.
        Schema::table('audit_logs', fn (Blueprint $table) => $table->unsignedBigInteger('user_id')->nullable()->change());
    }

    public function down(): void {
        // audit_logs.user_id sengaja tetap nullable: mengembalikannya butuh menghapus audit sistem.
        Schema::table('letters', fn (Blueprint $table) => $table->dropColumn('file_purged_at'));
        Schema::table('applications', fn (Blueprint $table) => $table->dropColumn('purged_at'));
    }
};
