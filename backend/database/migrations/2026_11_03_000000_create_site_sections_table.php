<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->string('subject_id', 64)->change();
        });
        Schema::create('site_sections', function (Blueprint $table) {
            $table->string('key', 32)->primary();
            $table->json('data');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        // Audit dipertahankan; jangan cast key situs historis kembali ke integer.
        Schema::dropIfExists('site_sections');
    }
};
