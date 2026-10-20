<?php

use App\Domain\AreaCode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('users', function (Blueprint $table) {
            $table->string('rt', 3)->nullable();
            $table->string('rw', 3)->nullable();
        });

        // Only territory spelling changes; existing statuses and encrypted data stay intact.
        DB::table('applications')->select(['id', 'rt', 'rw'])->chunkById(500, function ($applications) {
            foreach ($applications as $application) {
                DB::table('applications')->where('id', $application->id)->update([
                    'rt' => AreaCode::normalize($application->rt) ?? $application->rt,
                    'rw' => AreaCode::normalize($application->rw) ?? $application->rw,
                ]);
            }
        });
    }

    public function down(): void {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['rt', 'rw']));
    }
};
