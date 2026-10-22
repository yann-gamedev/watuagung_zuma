<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Satu surat final per permohonan; dibuat saat Kepala Desa menyetujui.
        Schema::create('letters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->unique()->constrained()->restrictOnDelete();
            $table->string('verification_code', 32)->unique();
            $table->foreignId('approved_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('approved_at');
            // File PDF terenkripsi di disk privat; null bila belum dibuat.
            $table->string('path')->nullable();
            $table->char('sha256', 64)->nullable();
            $table->enum('source', ['generated', 'uploaded'])->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('file_updated_at')->nullable();
        });
    }

    public function down(): void {
        Schema::dropIfExists('letters');
    }
};
