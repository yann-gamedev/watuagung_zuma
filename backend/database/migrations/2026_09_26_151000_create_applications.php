<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('users', fn (Blueprint $table) => $table->string('role')->default('staff'));
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->string('request_id')->unique();
            $table->string('lookup_secret_hash');
            $table->string('jenis_surat', 20);
            $table->string('nama');
            $table->text('nik');
            $table->text('no_kk');
            $table->string('tempat_lahir');
            $table->date('tanggal_lahir');
            $table->string('jenis_kelamin', 20);
            $table->text('alamat');
            $table->string('rt', 3);
            $table->string('rw', 3);
            $table->text('telepon');
            $table->string('nama_usaha')->nullable();
            $table->string('jenis_usaha')->nullable();
            $table->text('alamat_usaha')->nullable();
            $table->text('keperluan');
            $table->string('status', 30)->default('SUBMITTED')->index();
            $table->text('catatan')->nullable();
            $table->timestamps();
        });
        Schema::create('application_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->text('note')->nullable();
            $table->timestamp('created_at');
        });
    }
    public function down(): void {
        Schema::dropIfExists('application_events');
        Schema::dropIfExists('applications');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('role'));
    }
};
