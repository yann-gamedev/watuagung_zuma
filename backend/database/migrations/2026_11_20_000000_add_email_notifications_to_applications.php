<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Email pemohon (opsional) untuk notifikasi status. Kolom text karena isinya ciphertext (cast encrypted).
        // email_consent_at: saat pemohon mencentang persetujuan; email_unsubscribed_at: saat berhenti berlangganan.
        Schema::table('applications', function (Blueprint $table) {
            $table->text('email')->nullable();
            $table->timestamp('email_consent_at')->nullable();
            $table->timestamp('email_unsubscribed_at')->nullable();
        });
    }

    public function down(): void {
        Schema::table('applications', fn (Blueprint $table) => $table->dropColumn(['email', 'email_consent_at', 'email_unsubscribed_at']));
    }
};
