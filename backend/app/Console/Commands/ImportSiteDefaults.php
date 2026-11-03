<?php

namespace App\Console\Commands;

use App\Models\SiteSection;
use Database\Seeders\SiteSectionDefaults;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class ImportSiteDefaults extends Command
{
    protected $signature = 'site:import-defaults';

    protected $description = 'Impor konten bawaan hanya untuk bagian situs yang belum ada';

    public function handle(): int
    {
        $defaults = SiteSectionDefaults::data();

        try {
            $created = DB::transaction(function () use ($defaults): int {
                $count = 0;

                foreach ($defaults as $key => $data) {
                    $data = \App\Domain\SiteSectionRules::validate(\App\Domain\SiteSection::from($key), ['data' => $data]);
                    $section = SiteSection::firstOrCreate(['key' => $key], [
                        'data' => $data,
                        'updated_by' => null,
                    ]);

                    if (! $section->wasRecentlyCreated) {
                        continue;
                    }

                    DB::table('audit_logs')->insert([
                        'user_id' => null,
                        'action' => 'site.updated',
                        'subject_type' => 'site_section',
                        'subject_id' => $key,
                        'created_at' => now(),
                    ]);
                    $count++;
                }

                return $count;
            });
        } catch (Throwable) {
            $this->error('Impor gagal. Semua perubahan dibatalkan.');

            return self::FAILURE;
        }

        $preserved = count($defaults) - $created;
        $this->info("Dibuat: {$created}. Dipertahankan: {$preserved}.");

        return self::SUCCESS;
    }
}
