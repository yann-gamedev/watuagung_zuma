<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        // Widen first: ciphertext does not fit varchar(255)/date.
        Schema::table('applications', function (Blueprint $table) {
            $table->text('tempat_lahir')->change();
            $table->text('tanggal_lahir')->change();
        });

        // SQLite stored "Y-m-d H:i:s", PostgreSQL "Y-m-d": normalise before encrypting.
        $this->rewrite(fn ($row) => [
            'tempat_lahir' => Crypt::encryptString($row->tempat_lahir),
            'tanggal_lahir' => Crypt::encryptString(Carbon::parse($row->tanggal_lahir)->format('Y-m-d')),
        ]);
    }

    public function down(): void {
        $this->rewrite(fn ($row) => [
            'tempat_lahir' => Crypt::decryptString($row->tempat_lahir),
            'tanggal_lahir' => Crypt::decryptString($row->tanggal_lahir),
        ]);

        Schema::table('applications', function (Blueprint $table) {
            $table->string('tempat_lahir')->change();
            $table->date('tanggal_lahir')->using('tanggal_lahir::date')->change();
        });
    }

    private function rewrite(callable $map): void {
        DB::transaction(fn () => DB::table('applications')->select(['id', 'tempat_lahir', 'tanggal_lahir'])
            ->chunkById(500, function ($rows) use ($map) {
                foreach ($rows as $row) DB::table('applications')->where('id', $row->id)->update($map($row));
            }));
    }
};
