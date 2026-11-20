<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // E3: email notifikasi akun (terenkripsi, terpisah dari users.email untuk login lama) dan PIN persetujuan.
        Schema::table('users', function (Blueprint $table) {
            $table->text('notification_email')->nullable();
            $table->timestamp('notification_email_verified_at')->nullable();
            $table->string('approval_pin_hash')->nullable();
            $table->timestamp('approval_pin_set_at')->nullable();
        });

        // Tautan persetujuan sekali pakai. Hanya SHA-256 token yang disimpan; token mentah hanya ada di email.
        Schema::create('approval_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            // Dicabut saat status permohonan berubah lewat jalur mana pun.
            $table->timestamp('revoked_at')->nullable();
            // 5 PIN salah → dikunci.
            $table->unsignedTinyInteger('failed_pin_attempts')->default(0);
            $table->timestamp('locked_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['application_id', 'used_at', 'revoked_at']);
        });

        // Asal perubahan status: null = panel/sistem, 'email' = persetujuan lewat tautan email.
        Schema::table('application_events', fn (Blueprint $table) => $table->string('via', 16)->nullable());
    }

    public function down(): void {
        Schema::table('application_events', fn (Blueprint $table) => $table->dropColumn('via'));
        Schema::dropIfExists('approval_links');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn([
            'notification_email', 'notification_email_verified_at', 'approval_pin_hash', 'approval_pin_set_at',
        ]));
    }
};
