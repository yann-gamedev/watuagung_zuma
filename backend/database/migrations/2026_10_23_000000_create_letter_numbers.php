<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('letter_number_counters', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedBigInteger('sequence')->default(0);
        });
        Schema::create('letter_numbers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedBigInteger('sequence');
            $table->string('number')->unique();
            $table->enum('status', ['issued', 'void'])->default('issued');
            $table->text('void_reason')->nullable();
            $table->foreignId('issued_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('issued_at');
            $table->unique(['year', 'sequence']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('letter_numbers');
        Schema::dropIfExists('letter_number_counters');
    }
};
