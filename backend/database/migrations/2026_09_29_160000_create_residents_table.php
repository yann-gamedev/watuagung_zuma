<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('residents', function (Blueprint $table) {
            $table->id();
            $table->string('dummy_reference')->nullable()->unique();
            $table->text('nik');
            $table->text('nama');
            $table->text('tempat_lahir');
            $table->text('tanggal_lahir');
            $table->boolean('is_dummy')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('residents');
    }
};
