<?php

use App\Domain\ApplicationStatus;
use App\Domain\Letter;
use App\Models\Application;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Membuat akun panel lokal; kata sandi diminta tersembunyi dan tidak pernah disimpan di repositori.
Artisan::command('staff:create {username} {--role=staff} {--name=} {--email=} {--rt=} {--rw=}', function (string $username) {
    $role = $this->option('role');
    $data = ['username' => $username, 'role' => $role, 'name' => $this->option('name') ?: $username, 'email' => $this->option('email') ?: "$username@example.test"];
    $data += ['rt' => $this->option('rt'), 'rw' => $this->option('rw')];
    $validator = Validator::make($data, [
        'rt' => ['required_if:role,rt_head', 'nullable', 'string', 'regex:/\A[0-9]{1,3}\z/'],
        'rw' => ['required_if:role,rt_head,rw_head', 'nullable', 'string', 'regex:/\A[0-9]{1,3}\z/'],
        'username' => ['required', 'max:64', 'regex:/\A[a-z0-9][a-z0-9_-]*\z/', 'unique:users,username'],
        'role' => ['required', Rule::in(ApplicationStatus::PANEL_ROLES)],
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
    ]);
    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $message) $this->error($message);
        return 1;
    }
    $password = (string) $this->secret('Kata sandi (minimal 12 karakter)');
    if (mb_strlen($password) < 12 || $password !== (string) $this->secret('Ulangi kata sandi')) {
        $this->error('Kata sandi kurang dari 12 karakter atau tidak sama.');
        return 1;
    }
    User::create($data + ['password' => $password]);
    $this->info("Akun $username ($role) dibuat.");
    return 0;
})->purpose('Buat akun panel petugas (staff, village_head, admin, rt_head, rw_head)');

// Retensi: anonimkan permohonan berstatus akhir yang lebih tua dari RETENTION_APPLICATION_DAYS dan hapus PDF suratnya.
// Baris, nomor surat, riwayat status, dan audit tetap ada untuk buku register dan verifikasi QR.
Artisan::command('applications:purge {--dry-run}', function () {
    $days = config('retention.application_days');
    if ($days === null || $days === '') {
        $this->info('Retensi belum diaktifkan (RETENTION_APPLICATION_DAYS kosong). Tidak ada data yang diubah.');
        return 0;
    }
    if (($days = filter_var($days, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) === false) {
        $this->error('RETENTION_APPLICATION_DAYS harus bilangan bulat minimal 1. Tidak ada data yang diubah.');
        return 1;
    }
    $dry = (bool) $this->option('dry-run');
    $cutoff = now()->subDays($days);
    $this->info(($dry ? '[dry-run] ' : '')."Masa simpan $days hari; batas updated_at sebelum {$cutoff->toDateTimeString()}.");

    $count = 0;
    $query = Application::query()->whereIn('status', ['COMPLETED', 'REJECTED'])->whereNull('purged_at')->where('updated_at', '<', $cutoff);
    foreach ($query->lazyById(200) as $application) {
        $letter = Letter::find($application);
        $this->line(sprintf('%s  %-8s  %-9s  %s%s', $application->request_id, $application->jenis_surat, $application->status,
            $application->updated_at->toDateString(), $letter?->path ? '  + file surat' : ''));
        $count++;
        if ($dry) continue;

        DB::transaction(function () use ($application, $letter) {
            $initials = implode(' ', array_map(fn (string $word) => mb_substr($word, 0, 1).'.', preg_split('/\s+/u', trim($application->nama), -1, PREG_SPLIT_NO_EMPTY)));
            // Kolom NOT NULL terenkripsi diisi string kosong terenkripsi agar detail panel tetap dapat didekripsi.
            $application->forceFill([
                'nama' => $initials, 'nik' => '', 'no_kk' => '', 'telepon' => '', 'alamat' => '', 'alamat_usaha' => null,
                'tempat_lahir' => '', 'tanggal_lahir' => '', 'keperluan' => '', 'catatan' => null, 'purged_at' => now(),
            ]);
            $application->timestamps = false; // updated_at asli tetap.
            $application->save();
            if ($letter?->path) DB::table('letters')->where('id', $letter->id)->update(['path' => null, 'file_purged_at' => now()]);
            DB::table('audit_logs')->insert(['user_id' => null, 'action' => 'application.purged', 'subject_type' => 'application', 'subject_id' => $application->id, 'created_at' => now()]);
        });
        // Setelah commit: kegagalan hapus hanya menyisakan berkas yatim terenkripsi, bukan baris yang menunjuk berkas hilang.
        if ($letter?->path && ! Storage::disk('local')->delete($letter->path)) $this->warn("Berkas surat {$application->request_id} gagal dihapus.");
    }
    $this->info(($dry ? "[dry-run] $count permohonan akan dianonimkan; tidak ada yang diubah." : "$count permohonan dianonimkan."));
    return 0;
})->purpose('Anonimkan permohonan COMPLETED/REJECTED yang melewati masa simpan (RETENTION_APPLICATION_DAYS)');

// Hapus token petugas yang sudah kedaluwarsa lebih dari 24 jam.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
// Aman dijadwalkan: tanpa RETENTION_APPLICATION_DAYS perintah keluar tanpa mengubah apa pun.
Schedule::command('applications:purge')->daily();
