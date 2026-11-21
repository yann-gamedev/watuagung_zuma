<?php

use App\Domain\ApplicationStatus;
use App\Domain\ApplicationStatusChanged;
use App\Domain\Letter;
use App\Models\Application;
use App\Models\Business;
use App\Models\Post;
use App\Models\PostImage;
use App\Models\User;
use App\Support\AttachmentStore;
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
    if (! config('letters.neighborhood_approval', false) && in_array($role, ['rt_head', 'rw_head'], true)) {
        $this->error('Persetujuan RT/RW dinonaktifkan. Akun Ketua RT/RW tidak dapat dibuat.');
        return 1;
    }
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
    // Surat yang masih dalam masa unduh warga tidak dianonimkan atau dihapus sebelum masa itu habis.
    $query = Application::query()->whereIn('status', ['COMPLETED', 'REJECTED'])->whereNull('purged_at')->where('updated_at', '<', $cutoff)
        ->whereNotExists(fn ($sub) => $sub->select(DB::raw(1))->from('letters')->whereColumn('letters.application_id', 'applications.id')
            ->whereIn('letters.source', ['system', 'uploaded'])->where('letters.ready_at', '>=', now()->subDays(Letter::downloadDays())));
    foreach ($query->lazyById(200) as $application) {
        $letter = Letter::find($application);
        $attachments = DB::table('application_attachments')->where('application_id', $application->id)->whereNull('purged_at')->count();
        $this->line(sprintf('%s  %-8s  %-9s  %s%s%s', $application->request_id, $application->jenis_surat, $application->status,
            $application->updated_at->toDateString(), $letter?->path ? '  + file surat' : '', $attachments ? "  + $attachments lampiran" : ''));
        $count++;
        if ($dry) continue;

        $attachmentPaths = DB::transaction(function () use ($application, $letter) {
            $initials = implode(' ', array_map(fn (string $word) => mb_substr($word, 0, 1).'.', preg_split('/\s+/u', trim($application->nama), -1, PREG_SPLIT_NO_EMPTY)));
            // Kolom NOT NULL terenkripsi diisi string kosong terenkripsi agar detail panel tetap dapat didekripsi.
            $application->forceFill([
                'nama' => $initials, 'nik' => '', 'no_kk' => '', 'telepon' => '', 'alamat' => '', 'alamat_usaha' => null,
                'tempat_lahir' => '', 'tanggal_lahir' => '', 'keperluan' => '', 'catatan' => null, 'purged_at' => now(),
                'dusun' => null, 'agama' => null, 'kewarganegaraan' => null, 'status_perkawinan' => null, 'pendidikan' => null,
                'pekerjaan' => null, 'barang_hilang' => null, 'acara' => null, 'tempat_acara' => null, 'tanggal_mulai' => null,
                'tanggal_selesai' => null, 'jenis_hiburan' => null, 'isi_keterangan' => null, 'isi_keterangan_awal' => null,
                // Email notifikasi ikut dihapus; tanpa email tidak ada lagi notifikasi (ApplicantEmail::canNotify).
                'email' => null, 'email_consent_at' => null,
            ]);
            $application->timestamps = false; // updated_at asli tetap.
            $application->save();
            if ($letter?->path) DB::table('letters')->where('id', $letter->id)->update(['path' => null, 'file_purged_at' => now()]);
            DB::table('audit_logs')->insert(['user_id' => null, 'action' => 'application.purged', 'subject_type' => 'application', 'subject_id' => $application->id, 'created_at' => now()]);
            // Lampiran persyaratan ikut dihapus; audit attachment.purged per lampiran.
            return AttachmentStore::purgeRows($application->id);
        });
        // Setelah commit: kegagalan hapus hanya menyisakan berkas yatim terenkripsi, bukan baris yang menunjuk berkas hilang.
        if ($letter?->path && ! Storage::disk('local')->delete($letter->path)) $this->warn("Berkas surat {$application->request_id} gagal dihapus.");
        if (! AttachmentStore::deleteFiles($attachmentPaths)) $this->warn("Lampiran {$application->request_id} gagal dihapus.");
    }
    $this->info(($dry ? "[dry-run] $count permohonan akan dianonimkan; tidak ada yang diubah." : "$count permohonan dianonimkan."));
    return 0;
})->purpose('Anonimkan permohonan COMPLETED/REJECTED yang melewati masa simpan (RETENTION_APPLICATION_DAYS)');

// Retensi lampiran: hapus file KTP/KK/pengantar permohonan COMPLETED/REJECTED yang lebih tua dari ATTACHMENT_RETENTION_DAYS.
// Baris lampiran tetap (jenis, ukuran, hash) dengan purged_at; data permohonan tidak diubah.
Artisan::command('attachments:purge {--dry-run}', function () {
    $days = config('retention.attachment_days');
    if ($days === null || $days === '' || $days === 0 || $days === '0') {
        $this->info('Retensi lampiran mati (ATTACHMENT_RETENTION_DAYS kosong atau 0). Tidak ada lampiran yang dihapus.');
        return 0;
    }
    if (($days = filter_var($days, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) === false) {
        $this->error('ATTACHMENT_RETENTION_DAYS harus bilangan bulat minimal 0. Tidak ada lampiran yang dihapus.');
        return 1;
    }
    $dry = (bool) $this->option('dry-run');
    $cutoff = now()->subDays($days);
    $this->info(($dry ? '[dry-run] ' : '')."Masa simpan lampiran $days hari; batas updated_at sebelum {$cutoff->toDateTimeString()}.");
    $applications = 0;
    $files = 0;
    $query = Application::query()->whereIn('status', ['COMPLETED', 'REJECTED'])->where('updated_at', '<', $cutoff)
        ->whereExists(fn ($sub) => $sub->select(DB::raw(1))->from('application_attachments')
            ->whereColumn('application_attachments.application_id', 'applications.id')->whereNull('application_attachments.purged_at'));
    foreach ($query->select(['id', 'request_id', 'status', 'updated_at'])->lazyById(200) as $application) {
        $count = DB::table('application_attachments')->where('application_id', $application->id)->whereNull('purged_at')->count();
        $this->line(sprintf('%s  %-9s  %s  %d lampiran', $application->request_id, $application->status, $application->updated_at->toDateString(), $count));
        $applications++;
        $files += $count;
        if ($dry) continue;
        $paths = DB::transaction(fn () => AttachmentStore::purgeRows($application->id));
        if (! AttachmentStore::deleteFiles($paths)) $this->warn("Lampiran {$application->request_id} gagal dihapus.");
    }
    $this->info($dry ? "[dry-run] $files lampiran dari $applications permohonan akan dihapus; tidak ada yang diubah." : "$files lampiran dari $applications permohonan dihapus.");
    return 0;
})->purpose('Hapus lampiran persyaratan permohonan COMPLETED/REJECTED yang melewati ATTACHMENT_RETENTION_DAYS (bawaan 30)');

// Masa unduh warga berakhir tanpa pernah diunduh: READY_FOR_PICKUP → COMPLETED. Berkas surat tidak dihapus di sini
// (petugas tetap bisa mengunduh; retensi applications:purge yang menghapusnya).
Artisan::command('letters:expire-downloads {--dry-run}', function () {
    $dry = (bool) $this->option('dry-run');
    $days = Letter::downloadDays();
    $cutoff = now()->subDays($days);
    $this->info(($dry ? '[dry-run] ' : '')."Masa unduh $days hari; scan siap sebelum {$cutoff->toDateTimeString()}.");
    $count = 0;
    $query = Application::query()->where('status', 'READY_FOR_PICKUP')
        ->whereExists(fn ($sub) => $sub->select(DB::raw(1))->from('letters')->whereColumn('letters.application_id', 'applications.id')
            ->whereIn('letters.source', ['system', 'uploaded'])->where('letters.ready_at', '<', $cutoff));
    foreach ($query->select(['id', 'request_id', 'status'])->lazyById(200) as $application) {
        $this->line($application->request_id);
        if ($dry) { $count++; continue; }
        $changed = DB::transaction(function () use ($application, $cutoff) {
            $fresh = Application::whereKey($application->id)->lockForUpdate()->first();
            $readyAt = DB::table('letters')->where('application_id', $application->id)->value('ready_at');
            // Dicek ulang di bawah kunci: warga bisa mengunduh, atau petugas mengunggah ulang, sejak query dijalankan.
            if (! $fresh || $fresh->status !== 'READY_FOR_PICKUP' || $readyAt === null || ! \Illuminate\Support\Carbon::parse($readyAt)->lessThan($cutoff)) return false;
            $fresh->update(['status' => 'COMPLETED', 'catatan' => null]);
            $eventId = DB::table('application_events')->insertGetId([
                'application_id' => $fresh->id, 'from_status' => 'READY_FOR_PICKUP', 'to_status' => 'COMPLETED',
                'note' => \Illuminate\Support\Facades\Crypt::encryptString('Masa unduh berakhir'), 'created_at' => now(),
            ]);
            ApplicationStatusChanged::dispatch($fresh->id, 'READY_FOR_PICKUP', 'COMPLETED', $eventId);
            return true;
        });
        if ($changed) $count++;
    }
    $this->info($dry ? "[dry-run] $count permohonan akan diselesaikan; tidak ada yang diubah." : "$count permohonan diselesaikan karena masa unduh berakhir.");
    return 0;
})->purpose('Selesaikan permohonan READY_FOR_PICKUP yang masa unduh suratnya (LETTER_DOWNLOAD_DAYS) sudah lewat');

// Hapus foto berita/UMKM yang tidak lagi dirujuk baris aktif: sisa soft delete sebelum foto ikut terhapus,
// atau file yang gagal dihapus. File berumur < 1 jam dilewati agar unggahan yang belum commit tidak ikut terhapus.
Artisan::command('media:prune {--dry-run}', function () {
    $dry = (bool) $this->option('dry-run');
    $disk = Storage::disk('public');
    $cutoff = now()->subHour()->getTimestamp();
    $files = 0;
    // Foto tambahan milik berita terhapus: baris dilepas, file ikut dihitung sebagai yatim.
    $orphanImages = PostImage::whereIn('post_id', Post::onlyTrashed()->select('id'))->get(['id', 'path']);
    if ($orphanImages->isNotEmpty()) {
        $this->line(($dry ? '[dry-run] ' : '')."posts: {$orphanImages->count()} foto tambahan pada berita terhapus dilepas.");
        if (! $dry) PostImage::whereKey($orphanImages->pluck('id'))->delete();
    }
    $inlinePaths = PostImage::whereIn('post_id', Post::query()->select('id'))->pluck('path');
    foreach (['posts' => [Post::class, 'cover_path'], 'businesses' => [Business::class, 'photo_path']] as $directory => [$model, $column]) {
        $trashed = $model::onlyTrashed()->whereNotNull($column);
        // toBase: updated_at baris terhapus tidak berubah.
        $rows = $dry ? $trashed->count() : $trashed->toBase()->update([$column => null]);
        if ($rows > 0) $this->line(($dry ? '[dry-run] ' : '')."$directory: $rows baris terhapus dilepas dari fotonya.");
        $referenced = $model::query()->whereNotNull($column)->pluck($column);
        if ($model === Post::class) $referenced = $referenced->merge($inlinePaths);
        $referenced = $referenced->flip();
        foreach ($disk->files($directory) as $path) {
            if ($referenced->has($path) || $disk->lastModified($path) > $cutoff) continue;
            $this->line(($dry ? '[dry-run] ' : '')."hapus $path");
            $files++;
            if (! $dry && ! $disk->delete($path)) $this->warn("$path gagal dihapus.");
        }
    }
    $this->info($dry ? "[dry-run] $files file akan dihapus; tidak ada yang diubah." : "$files file foto yatim dihapus.");
    return 0;
})->purpose('Hapus foto sampul/tambahan berita dan foto UMKM yang tidak dirujuk data aktif');

// Hapus token petugas yang sudah kedaluwarsa lebih dari 24 jam.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
// Aman dijadwalkan: tanpa RETENTION_APPLICATION_DAYS perintah keluar tanpa mengubah apa pun.
Schedule::command('applications:purge')->daily();
// Bawaan 30 hari; ATTACHMENT_RETENTION_DAYS=0 mematikan.
Schedule::command('attachments:purge')->daily();
// Menyelesaikan permohonan yang masa unduhnya lewat; tidak menghapus berkas.
Schedule::command('letters:expire-downloads')->daily();
// Hanya menghapus file yang tidak dirujuk berita/UMKM aktif.
Schedule::command('media:prune')->daily();
// Antrean email (QUEUE_CONNECTION=database) untuk lokal/VPS. Hostinger tidak memakai schedule:run (proc_open
// dimatikan); perintah yang sama dipasang langsung sebagai cron tiap menit (deploy/hostinger.md § H).
Schedule::command('queue:work --stop-when-empty --max-time=50 --tries=3')->everyMinute()->withoutOverlapping();
