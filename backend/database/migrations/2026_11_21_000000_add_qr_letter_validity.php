<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('letters', function (Blueprint $table) {
            $table->enum('source', ['generated', 'uploaded', 'system'])->nullable()->change();
            $table->timestamp('valid_until')->nullable();
        });
        // Existing released letters receive the agreed seven-day policy; no PDF is regenerated.
        DB::table('letters')->whereNotNull('ready_at')->orderBy('id')->chunkById(500, function ($letters) {
            foreach ($letters as $letter) {
                DB::table('letters')->where('id', $letter->id)->update([
                    'valid_until' => Carbon::parse($letter->ready_at)->addDays(7),
                ]);
            }
        });
    }

    public function down(): void
    {
        DB::table('letters')->where('source', 'system')->update(['source' => 'generated']);
        Schema::table('letters', function (Blueprint $table) {
            $table->enum('source', ['generated', 'uploaded'])->nullable()->change();
            $table->dropColumn('valid_until');
        });
    }
};
