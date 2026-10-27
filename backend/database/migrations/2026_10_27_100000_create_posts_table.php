<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title', 160);
            // Divalidasi terhadap App\Domain\PostCategory; string agar daftar bisa berubah tanpa migration.
            $table->string('category', 32);
            $table->string('summary', 300);
            // Teks biasa; frontend merender sebagai teks, bukan HTML.
            $table->text('body');
            $table->enum('status', ['draft', 'published']);
            $table->timestamp('published_at')->nullable();
            $table->string('cover_path')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'published_at']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('posts');
    }
};
