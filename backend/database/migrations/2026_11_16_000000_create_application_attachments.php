<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Lampiran persyaratan (KTP, KK, pengantar RT/RW). Isi file terenkripsi di disk privat;
        // nama file asli sengaja tidak punya kolom karena bisa memuat nama/NIK warga.
        Schema::create('application_attachments', function (Blueprint $table) {
            $table->id();
            // Cascade hanya menghapus baris; file di disk harus dihapus oleh kode yang menghapus permohonan.
            $table->foreignId('application_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 32);
            // Tipe hasil deteksi isi file (finfo), bukan Content-Type dari klien.
            $table->string('original_mime', 64);
            $table->string('stored_mime', 64);
            // Ukuran isi yang disimpan sebelum dienkripsi (gambar: setelah encode ulang).
            $table->unsignedInteger('size_bytes');
            // null setelah file dihapus oleh retensi.
            $table->string('path')->nullable();
            // Hash isi asli yang diunggah, untuk deteksi duplikat dan integritas.
            $table->char('sha256', 64);
            $table->enum('uploaded_by', ['applicant', 'staff']);
            $table->timestamp('purged_at')->nullable();
            $table->timestamps();
            // Satu baris per dokumen per permohonan: penggantian memperbarui baris ini, bukan menambah baris.
            $table->unique(['application_id', 'kind']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('application_attachments');
    }
};
