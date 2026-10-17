<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Hapus token petugas yang sudah kedaluwarsa lebih dari 24 jam.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
