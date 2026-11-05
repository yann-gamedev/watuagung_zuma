<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name', 120);
            // Divalidasi terhadap App\Domain\BusinessCategory; string agar daftar bisa berubah tanpa migration.
            $table->string('category', 32);
            // Teks biasa; frontend merender sebagai teks, bukan HTML.
            $table->text('description');
            $table->string('hamlet', 16)->nullable();
            // Cast encrypted: ciphertext lebih panjang dari isi, jadi text.
            $table->text('owner_name')->nullable();
            $table->text('whatsapp')->nullable();
            $table->boolean('consent_public_contact')->default(false);
            $table->string('photo_path')->nullable();
            $table->enum('status', ['draft', 'published']);
            $table->timestamp('published_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'published_at']);
            $table->index('category');
        });
    }

    public function down(): void {
        Schema::dropIfExists('businesses');
    }
};
