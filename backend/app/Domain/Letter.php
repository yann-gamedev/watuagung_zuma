<?php

namespace App\Domain;

use App\Models\Application;
use App\Models\User;
use BaconQrCode\Renderer\GDLibRenderer;
use BaconQrCode\Writer;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Surat final: kode verifikasi dibuat saat Kepala Desa menyetujui; PDF (otomatis atau unggahan petugas)
 * disimpan terenkripsi di disk privat karena memuat NIK dan alamat.
 */
class Letter
{
    public const DRAFT_STATUSES = ['PROCESSING', 'WAITING_APPROVAL'];
    public const FINAL_STATUSES = ['APPROVED', 'READY_FOR_PICKUP', 'COMPLETED'];
    public const UPLOAD_STATUSES = ApplicationStatus::LETTER_UPLOAD_STATUSES;
    /** Warga dapat mengunduh surat pada status ini (dalam masa unduh). */
    public const DOWNLOAD_STATUSES = ['READY_FOR_PICKUP', 'COMPLETED'];

    /** Dipanggil di dalam transaksi perubahan status ke APPROVED. */
    public static function approve(Application $application, User $head, Carbon $releasedAt, array &$written = []): void
    {
        DB::table('letters')->insert([
            'application_id' => $application->id, 'verification_code' => Str::random(32),
            'approved_by' => $head->id, 'approved_at' => $releasedAt, 'ready_at' => $releasedAt,
            'valid_until' => $releasedAt->copy()->addDays(self::validityDays()),
        ]);
        self::generate($application, $written);
    }

    public static function find(Application $application): ?object
    {
        return DB::table('letters')->where('application_id', $application->id)->first();
    }

    /** PDF final dari template; dibuat sekali lalu disimpan. Unggahan petugas tidak pernah ditimpa. */
    public static function generate(Application $application, array &$written = []): object
    {
        $letter = self::find($application);
        if ($letter->path === null) self::store($letter, self::render($application, $letter), $letter->ready_at ? 'system' : 'generated', null, $written);

        return self::find($application);
    }

    public static function store(object $letter, string $pdf, string $source, ?User $uploader, array &$written = []): void
    {
        $root = DB::transactionLevel() === 0;
        try {
            DB::transaction(function () use ($letter, $pdf, $source, $uploader, &$written) {
                $path = 'letters/'.$letter->application_id.'-'.Str::uuid().'.pdf';
                $written[] = $path;
                // Laravel keeps this callback through nested commits, including the email decision transaction.
                DB::afterRollBack(fn () => self::deleteUnreferenced([$path]));
                if (! Storage::disk('local')->put($path, Crypt::encryptString($pdf))) {
                    throw new \RuntimeException('Berkas surat gagal disimpan.');
                }
                DB::table('letters')->where('id', $letter->id)->update([
                    'path' => $path, 'sha256' => hash('sha256', $pdf), 'source' => $source,
                    'uploaded_by' => $uploader?->id, 'file_updated_at' => now(),
                ]);
                if ($letter->path !== null) DB::afterCommit(fn () => Storage::disk('local')->delete($letter->path));
            });
        } finally {
            if ($root) self::discardUnreferenced($written);
        }
    }

    /** Only the root transaction owner calls this, including after a failed COMMIT. */
    public static function discardUnreferenced(array $written): void
    {
        try {
            // A failed COMMIT can leave PDO in a transaction although Laravel's level is already zero.
            if (DB::transactionLevel() > 0) DB::rollBack(0);
            elseif (DB::getPdo()->inTransaction()) DB::getPdo()->rollBack();
        } catch (\Throwable $e) {
            report($e);
        }
        try {
            // COMMIT exceptions bypass Laravel's manager rollback, leaving stale event callbacks behind.
            // File rollback callbacks check references too: an ambiguous COMMIT may have succeeded.
            app('db.transactions')->rollback(DB::connection()->getName(), 0);
        } catch (\Throwable $e) {
            report($e);
        }
        self::deleteUnreferenced($written);
    }

    private static function deleteUnreferenced(array $written): void
    {
        if ($written === []) return;
        try {
            $referenced = DB::table('letters')->useWritePdo()->whereIn('path', $written)->pluck('path')->all();
            foreach (array_diff($written, $referenced) as $path) {
                if (! Storage::disk('local')->delete($path)) report(new \RuntimeException('Berkas surat yatim gagal dihapus.'));
            }
        } catch (\Throwable $e) {
            // Cannot establish committed references: keep files rather than risk deleting a committed PDF.
            report($e);
        }
    }

    public static function downloadDays(): int
    {
        $days = filter_var(config('letters.download_days', 7), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        return $days === false ? 7 : $days;
    }

    public static function validityDays(): int
    {
        $days = filter_var(config('letters.validity_days', 7), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        return $days === false ? 7 : $days;
    }

    /** Batas akhir unduhan warga; tidak dihitung ulang dari waktu penggantian PDF. */
    public static function downloadUntil(?object $letter): ?Carbon
    {
        if (! $letter || ! in_array($letter->source, ['system', 'uploaded'], true) || $letter->ready_at === null) return null;

        return Carbon::parse($letter->ready_at)->addDays(self::downloadDays());
    }

    /**
     * 'available' | 'unavailable' (belum dirilis / status lain) | 'expired' (masa unduh lewat / berkas dihapus).
     */
    public static function downloadState(Application $application, ?object $letter): string
    {
        $until = self::downloadUntil($letter);
        if (! in_array($application->status, self::DOWNLOAD_STATUSES, true) || $until === null) return 'unavailable';
        if ($letter->file_purged_at !== null || $letter->path === null || now()->greaterThan($until)) return 'expired';

        return 'available';
    }

    public static function contents(object $letter): string
    {
        return Crypt::decryptString(Storage::disk('local')->get($letter->path));
    }

    /** $letter null = draf berwatermark, tanpa QR. */
    public static function render(Application $application, ?object $letter): string
    {
        return Pdf::loadView(self::view(LetterType::from($application->jenis_surat)), [
            'a' => $application,
            'title' => LetterType::from($application->jenis_surat)->title(),
            'draft' => $letter === null,
            'number' => DB::table('letter_numbers')->where('application_id', $application->id)
                ->where('status', 'issued')->orderByDesc('id')->value('number'),
            'date' => ($letter ? Carbon::parse($letter->approved_at) : now())->locale('id'),
            'qr' => $letter ? base64_encode(self::qr($letter->verification_code, 240)) : null,
            'desa' => config('letters.desa'),
            'validUntil' => $letter?->valid_until ? Carbon::parse($letter->valid_until)->locale('id') : null,
            'validityDays' => self::validityDays(),
        ])->setPaper('a4')->output();
    }

    public static function view(LetterType $type): string
    {
        return 'letters.'.strtolower($type->value);
    }

    public static function verifyUrl(string $code): string
    {
        return config('letters.verify_url').'?kode='.$code;
    }

    public static function qr(string $code, int $size = 600): string
    {
        return (new Writer(new GDLibRenderer($size)))->writeString(self::verifyUrl($code));
    }

    /** "Siti Wulandari" → "S*** W********". */
    public static function maskName(string $name): string
    {
        return implode(' ', array_map(
            fn (string $word) => mb_substr($word, 0, 1).str_repeat('*', max(mb_strlen($word) - 1, 0)),
            preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY),
        ));
    }
}
