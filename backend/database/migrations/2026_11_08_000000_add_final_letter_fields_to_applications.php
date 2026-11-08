<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /** Data diri dan isian khusus enam jenis surat final; semua nullable agar data lama tetap sah. */
    private const COLUMNS = [
        'dusun', 'agama', 'kewarganegaraan', 'status_perkawinan', 'pendidikan', 'pekerjaan',
        'barang_hilang', 'acara', 'tempat_acara', 'tanggal_mulai', 'tanggal_selesai', 'jenis_hiburan',
        'isi_keterangan', 'isi_keterangan_awal',
    ];

    public function up(): void {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('dusun', 20)->nullable();
            // Terenkripsi di model: ciphertext butuh text.
            $table->text('agama')->nullable();
            $table->string('kewarganegaraan', 3)->nullable();
            $table->text('status_perkawinan')->nullable();
            $table->string('pendidikan', 60)->nullable();
            $table->string('pekerjaan', 60)->nullable();
            $table->string('barang_hilang', 200)->nullable();
            $table->string('acara', 120)->nullable();
            $table->string('tempat_acara', 120)->nullable();
            $table->date('tanggal_mulai')->nullable();
            $table->date('tanggal_selesai')->nullable();
            $table->string('jenis_hiburan', 120)->nullable();
            // Versi yang dicetak (dapat disunting petugas) dan teks asli warga sebagai pembanding.
            $table->text('isi_keterangan')->nullable();
            $table->text('isi_keterangan_awal')->nullable();
        });
    }

    public function down(): void {
        Schema::table('applications', fn (Blueprint $table) => $table->dropColumn(self::COLUMNS));
    }
};
