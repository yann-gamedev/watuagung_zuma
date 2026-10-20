<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    // Riwayat non-status (mis. ACCESS_CODE_RESET); null = perubahan status biasa.
    public function up(): void {
        Schema::table('application_events', fn (Blueprint $table) => $table->string('action', 40)->nullable());
    }

    public function down(): void {
        Schema::table('application_events', fn (Blueprint $table) => $table->dropColumn('action'));
    }
};
