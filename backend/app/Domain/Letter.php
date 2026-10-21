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
    public const UPLOAD_STATUSES = ['APPROVED', 'READY_FOR_PICKUP'];

    /** Dipanggil di dalam transaksi perubahan status ke APPROVED. */
    public static function approve(Application $application, User $head): void
    {
        DB::table('letters')->insert([
            'application_id' => $application->id, 'verification_code' => Str::random(32),
            'approved_by' => $head->id, 'approved_at' => now(),
        ]);
    }

    public static function find(Application $application): ?object
    {
        return DB::table('letters')->where('application_id', $application->id)->first();
    }

    /** PDF final dari template; dibuat sekali lalu disimpan. Unggahan petugas tidak pernah ditimpa. */
    public static function generate(Application $application): object
    {
        $letter = self::find($application);
        if ($letter->path === null) self::store($letter, self::render($application, $letter), 'generated', null);

        return self::find($application);
    }

    public static function store(object $letter, string $pdf, string $source, ?User $uploader): void
    {
        $path = 'letters/'.$letter->application_id.'-'.$source.'.pdf';
        Storage::disk('local')->put($path, Crypt::encryptString($pdf));
        DB::table('letters')->where('id', $letter->id)->update([
            'path' => $path, 'sha256' => hash('sha256', $pdf), 'source' => $source,
            'uploaded_by' => $uploader?->id, 'file_updated_at' => now(),
        ]);
        if ($letter->path !== null && $letter->path !== $path) Storage::disk('local')->delete($letter->path);
    }

    public static function contents(object $letter): string
    {
        return Crypt::decryptString(Storage::disk('local')->get($letter->path));
    }

    /** $letter null = draf berwatermark, tanpa QR. */
    public static function render(Application $application, ?object $letter): string
    {
        $type = strtolower($application->jenis_surat);

        return Pdf::loadView('letters.'.$type, [
            'a' => $application,
            'draft' => $letter === null,
            'number' => DB::table('letter_numbers')->where('application_id', $application->id)
                ->where('status', 'issued')->orderByDesc('id')->value('number'),
            'date' => ($letter ? Carbon::parse($letter->approved_at) : now())->locale('id'),
            'qr' => $letter ? base64_encode(self::qr($letter->verification_code, 240)) : null,
            'desa' => config('letters.desa'),
        ])->setPaper('a4')->output();
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
