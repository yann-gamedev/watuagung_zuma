<?php

namespace App\Support;

use App\Domain\AttachmentKind;
use App\Models\Application;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Lampiran persyaratan pengajuan (KTP, KK, pengantar RT/RW): divalidasi dari isi file,
 * gambar di-encode ulang tanpa metadata, lalu disimpan terenkripsi di disk privat.
 * Nama file asli tidak pernah disimpan atau dicatat karena bisa memuat nama/NIK warga.
 */
class AttachmentStore
{
    public const DISK = 'local';
    public const MAX_BYTES = 5 * 1024 * 1024;
    public const MAX_IMAGE_WIDTH = 2000;
    /** Sisi terpendek; di bawah ini tulisan dokumen tidak terbaca. */
    public const MIN_IMAGE_SIDE = 600;
    /** Batas memori GD, sama dengan unggahan gambar lain. */
    public const MAX_IMAGE_SIDE = 6000;
    public const MAX_PDF_PAGES = 10;
    private const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

    /**
     * Pemeriksaan murah (tanpa decode gambar) agar dapat digabung dengan kesalahan formulir.
     *
     * @param  mixed  $files  nilai field `lampiran` dari permintaan
     * @param  list<AttachmentKind>  $required
     * @return array<string, list<string>> kesalahan per `lampiran.{KIND}`; kosong = lolos
     */
    public static function errors(mixed $files, array $required): array
    {
        $files = is_array($files) ? $files : [];
        $errors = [];
        foreach ($required as $kind) {
            $file = $files[$kind->value] ?? null;
            $error = match (true) {
                $file === null || $file === '' => $kind->label().' wajib dilampirkan.',
                ! $file instanceof UploadedFile => $kind->label().' harus berupa file.',
                default => self::fileError($file, $kind),
            };
            if ($error !== null) $errors['lampiran.'.$kind->value] = [$error];
        }
        $known = array_map(fn (AttachmentKind $kind) => $kind->value, $required);
        foreach (array_keys($files) as $key) {
            if (! in_array((string) $key, $known, true)) $errors['lampiran'] = ['Jenis lampiran tidak dikenal untuk surat ini.'];
        }

        return $errors;
    }

    private static function fileError(UploadedFile $file, AttachmentKind $kind): ?string
    {
        $label = $kind->label();
        // PHP menolak file sebelum Laravel (mis. melebihi upload_max_filesize): bukan salah format.
        if (! $file->isValid()) return $label.' gagal diterima server. Ukuran file mungkin melebihi batas unggah; coba file yang lebih kecil.';
        $size = $file->getSize();
        if ($size === false || $size === 0) return $label.' kosong atau tidak dapat dibaca.';
        if ($size > self::MAX_BYTES) return 'Ukuran '.$label.' maksimal 5 MB.';
        $mime = self::detectMime($file);
        if ($mime === 'application/pdf') return self::pdfError($file, $label);
        if (! in_array($mime, self::IMAGE_MIMES, true)) return $label.' harus berupa foto JPG, PNG, WebP, atau berkas PDF.';
        $info = @getimagesize($file->getRealPath());
        if ($info === false) return $label.' tidak dapat dibaca. Pilih foto JPG, PNG, atau WebP yang valid.';
        if (min($info[0], $info[1]) < self::MIN_IMAGE_SIDE) return 'Foto terlalu kecil untuk dibaca. Sisi terpendek foto '.$label.' minimal '.self::MIN_IMAGE_SIDE.' piksel.';
        if (max($info[0], $info[1]) > self::MAX_IMAGE_SIDE) return 'Foto '.$label.' terlalu besar. Sisi terpanjang maksimal '.self::MAX_IMAGE_SIDE.' piksel.';

        return null;
    }

    /** Tipe dari isi file; ekstensi dan Content-Type klien bisa dipalsukan. */
    private static function detectMime(UploadedFile $file): string
    {
        return (string) (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
    }

    private static function pdfError(UploadedFile $file, string $label): ?string
    {
        $bytes = (string) file_get_contents($file->getRealPath());
        if (! str_starts_with($bytes, '%PDF-')) return $label.' bukan berkas PDF yang valid.';
        $pages = self::pdfPageCount($bytes);
        if ($pages !== null && $pages > self::MAX_PDF_PAGES) return 'PDF '.$label.' maksimal '.self::MAX_PDF_PAGES.' halaman.';

        return null;
    }

    /**
     * Perkiraan jumlah halaman tanpa pustaka PDF: objek /Type /Page dan /Count pada pohon halaman.
     * PDF yang menyimpan objeknya dalam stream terkompresi tidak terbaca di sini → null (batas dilewati).
     */
    public static function pdfPageCount(string $bytes): ?int
    {
        $objects = preg_match_all('~/Type\s*/Page(?![A-Za-z])~', $bytes);
        $count = preg_match_all('~/Type\s*/Pages\b[^>]*?/Count\s+(\d+)|/Count\s+(\d+)[^>]*?/Type\s*/Pages\b~s', $bytes, $matches)
            ? max(array_map('intval', array_merge($matches[1], $matches[2])))
            : 0;
        $pages = max((int) $objects, $count);

        return $pages > 0 ? $pages : null;
    }

    /**
     * Simpan semua lampiran satu permohonan. Panggil di dalam DB::transaction setelah errors() kosong.
     * Path yang sudah tertulis dicatat di $written supaya pemanggil dapat memanggil discard() bila transaksi gagal.
     *
     * @param  array<string, UploadedFile>  $files  kunci = AttachmentKind->value
     * @param  list<AttachmentKind>  $kinds
     * @param  list<string>  $written
     */
    public static function storeAll(Application $application, array $files, array $kinds, string $uploadedBy, array &$written): void
    {
        foreach ($kinds as $kind) {
            $file = $files[$kind->value];
            $mime = self::detectMime($file);
            if ($mime === 'application/pdf') {
                // PDF disimpan apa adanya (terenkripsi); metadata dokumennya tidak dapat dibuang tanpa pustaka PDF.
                [$bytes, $storedMime] = [(string) file_get_contents($file->getRealPath()), 'application/pdf'];
            } else {
                try {
                    [$bytes, $extension] = ImageProcessor::encode($file, self::MAX_IMAGE_WIDTH);
                } catch (ValidationException) {
                    throw ValidationException::withMessages(['lampiran.'.$kind->value => $kind->label().' tidak dapat dibaca. Pilih foto JPG, PNG, atau WebP yang valid.']);
                }
                $storedMime = $extension === 'webp' ? 'image/webp' : 'image/jpeg';
            }
            $path = 'attachments/'.$application->id.'/'.Str::uuid().'.bin';
            // Dicatat sebelum menulis: tulisan yang gagal di tengah tetap ikut dibersihkan.
            $written[] = $path;
            if (! Storage::disk(self::DISK)->put($path, Crypt::encryptString($bytes))) {
                throw new RuntimeException('Lampiran gagal disimpan.');
            }
            DB::table('application_attachments')->insert([
                'application_id' => $application->id, 'kind' => $kind->value,
                'original_mime' => $mime, 'stored_mime' => $storedMime, 'size_bytes' => strlen($bytes),
                'path' => $path, 'sha256' => hash_file('sha256', $file->getRealPath()),
                'uploaded_by' => $uploadedBy, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    /**
     * Hapus file yang sudah tertulis saat transaksi dibatalkan. Hanya path persis milik permintaan ini:
     * id permohonan yang di-rollback bisa dipakai ulang oleh pengajuan lain.
     *
     * @param  list<string>  $written
     */
    public static function discard(array $written): void
    {
        if ($written === []) return;
        $disk = Storage::disk(self::DISK);
        $disk->delete($written);
        // rmdir hanya berhasil pada folder kosong, jadi aman terhadap pengajuan lain.
        @rmdir($disk->path(dirname($written[0])));
    }

    /** Isi lampiran yang sudah didekripsi. */
    public static function contents(object $attachment): string
    {
        return Crypt::decryptString((string) Storage::disk(self::DISK)->get($attachment->path));
    }

    /**
     * Jenis lampiran yang sudah diterima dan belum dihapus retensi; aman untuk respons publik.
     *
     * @return list<string>
     */
    public static function receivedKinds(Application $application): array
    {
        $kinds = DB::table('application_attachments')->where('application_id', $application->id)->whereNull('purged_at')->pluck('kind')->all();

        return array_values(array_filter(array_map(fn (AttachmentKind $kind) => $kind->value, AttachmentKind::cases()), fn (string $kind) => in_array($kind, $kinds, true)));
    }
}
