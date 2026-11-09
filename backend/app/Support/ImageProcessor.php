<?php
namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ImageProcessor {
    public static function store(UploadedFile $file, string $directory, int $maxSizeKiB, int $maxWidth, int $minWidth = 600, int $minHeight = 400, int $maxInputWidth = 6000, int $maxInputHeight = 6000): string {
        Validator::make(['file'=>$file], ['file'=>[
            'bail', 'required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:'.$maxSizeKiB,
            "dimensions:min_width={$minWidth},min_height={$minHeight},max_width={$maxInputWidth},max_height={$maxInputHeight}",
        ]], [
            'file.required'=>'Pilih foto yang akan diunggah.',
            'file.file'=>'Foto harus berupa file yang valid.',
            'file.mimes'=>'Format foto harus JPG, JPEG, PNG, atau WebP.',
            'file.max'=>"Ukuran foto maksimal {$maxSizeKiB} KiB.",
            'file.dimensions'=>"Lebar foto harus {$minWidth}–{$maxInputWidth} piksel dan tinggi {$minHeight}–{$maxInputHeight} piksel.",
        ])->validate();
        abort_unless(extension_loaded('gd'), 503, 'Pengolah foto belum tersedia. Hubungi administrator.');
        $bytes = file_get_contents($file->getRealPath());
        abort_if($bytes === false, 500, 'Foto gagal dibaca.');
        $source = @imagecreatefromstring($bytes);
        if ($source === false) throw ValidationException::withMessages(['file'=>'Foto tidak dapat dibaca. Pilih JPG, PNG, atau WebP yang valid.']);
        $webp = function_exists('imagewebp') && (imagetypes() & IMG_WEBP) !== 0;
        $width = min($maxWidth, imagesx($source));
        $height = max(1, (int) round(imagesy($source) * $width / imagesx($source)));
        $image = imagecreatetruecolor($width, $height);
        $stream = tmpfile();
        try {
            abort_if($image === false || $stream === false, 500, 'Foto gagal diproses.');
            // Kanvas baru hanya berisi piksel: EXIF/GPS dan metadata lain tidak disalin.
            if ($webp) {
                imagealphablending($image, false);
                imagesavealpha($image, true);
                imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
            } else {
                imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
            }
            abort_unless(imagecopyresampled($image, $source, 0, 0, 0, 0, $width, $height, imagesx($source), imagesy($source)), 500, 'Foto gagal diperkecil.');
            $encoded = $webp ? imagewebp($image, $stream, 80) : imagejpeg($image, $stream, 82);
            abort_unless($encoded && ftell($stream) > 0, 500, 'Foto gagal disimpan.');
            rewind($stream);
            $path = $directory.'/'.Str::uuid().($webp ? '.webp' : '.jpg');
            try {
                abort_unless(Storage::disk('public')->put($path, $stream), 500, 'Foto gagal disimpan.');
            } catch (\Throwable $e) {
                Storage::disk('public')->delete($path);
                throw $e;
            }
            return $path;
        } finally {
            imagedestroy($source);
            if ($image !== false) imagedestroy($image);
            if (is_resource($stream)) fclose($stream);
        }
    }
}
