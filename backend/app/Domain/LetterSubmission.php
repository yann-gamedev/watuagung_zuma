<?php

namespace App\Domain;

use Closure;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/** Validasi pengajuan warga per jenis surat; pilihan baku mengikuti docs/PROMPTS-SURAT.md. */
class LetterSubmission
{
    public const DUSUN = ['Watuagung', 'Talang', 'Sekar'];
    public const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Kepercayaan terhadap Tuhan YME'];
    public const KEWARGANEGARAAN = ['WNI', 'WNA'];
    public const STATUS_PERKAWINAN = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'];
    public const PENDIDIKAN = [
        'Tidak/Belum Sekolah', 'Belum Tamat SD/Sederajat', 'Tamat SD/Sederajat', 'SLTP/Sederajat', 'SLTA/Sederajat',
        'Diploma I/II', 'Akademi/Diploma III/Sarjana Muda', 'Diploma IV/Strata I', 'Strata II', 'Strata III',
    ];

    /** @return array<string, mixed> data tervalidasi, siap disimpan */
    public static function validate(array $input): array
    {
        // Bawaan WNI sesuai rancangan surat.
        if (blank($input['kewarganegaraan'] ?? null)) $input['kewarganegaraan'] = 'WNI';
        $type = is_string($input['jenis_surat'] ?? null) ? LetterType::tryFrom($input['jenis_surat']) : null;

        return Validator::make($input, self::rules($type, $input), self::messages(), self::attributes())->validate();
    }

    /** @return array<string, list<mixed>> */
    public static function rules(?LetterType $type, array $input = []): array
    {
        $full = $type === null || $type->requiresFullPersonalData() ? 'required' : 'nullable';
        $rules = [
            'jenis_surat' => ['required', 'string', Rule::in(LetterType::offeredValues())],
            'nama' => ['required', 'string', 'min:2', 'max:200'],
            'nik' => ['required', 'regex:/^[0-9]{16}$/'],
            'no_kk' => ['required', 'regex:/^[0-9]{16}$/'],
            'tempat_lahir' => ['required', 'string', 'min:2', 'max:200'],
            'tanggal_lahir' => ['required', 'date_format:Y-m-d', 'after_or_equal:1900-01-01', 'before_or_equal:today'],
            'jenis_kelamin' => ['required', Rule::in(['Laki-laki', 'Perempuan'])],
            'dusun' => ['required', 'string', Rule::in(self::DUSUN)],
            'alamat' => ['required', 'string', 'min:2', 'max:200'],
            'rt' => ['required', 'regex:/^[0-9]{1,3}$/'],
            'rw' => ['required', 'regex:/^[0-9]{1,3}$/'],
            'telepon' => ['required', 'regex:/^(?:\+62|0)[0-9]{8,13}$/'],
            'kewarganegaraan' => ['required', 'string', Rule::in(self::KEWARGANEGARAAN)],
            'agama' => [$full, 'string', Rule::in(self::AGAMA)],
            'status_perkawinan' => [$full, 'string', Rule::in(self::STATUS_PERKAWINAN)],
            'pendidikan' => [$full, 'string', Rule::in(self::PENDIDIKAN)],
            'pekerjaan' => [$full, 'string', 'min:2', 'max:60'],
            'keperluan' => ['required', 'string', 'min:2', 'max:200'],
        ];
        $specific = [
            'barang_hilang' => ['required', 'string', 'min:2', 'max:200'],
            'acara' => ['required', 'string', 'min:2', 'max:120'],
            'tempat_acara' => ['required', 'string', 'min:2', 'max:120'],
            'jenis_hiburan' => ['required', 'string', 'min:2', 'max:120'],
            'tanggal_mulai' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'tanggal_selesai' => ['required', 'date_format:Y-m-d', 'after_or_equal:tanggal_mulai',
                fn (string $attribute, mixed $value, Closure $fail) => self::checkEventRange($input['tanggal_mulai'] ?? null, $value, $fail)],
            'isi_keterangan' => ['required', 'string', 'min:2', 'max:500'],
        ];
        $own = $type?->isOffered() ? $type->specificFields() : [];
        foreach (LetterType::SPECIFIC_FIELDS as $field) {
            $rules[$field] = in_array($field, $own, true) ? $specific[$field] : ['prohibited'];
        }

        return $rules;
    }

    private static function checkEventRange(mixed $start, mixed $value, Closure $fail): void
    {
        // Format salah sudah ditangani aturan date_format.
        $startDate = self::date($start);
        $endDate = self::date($value);
        if ($startDate && $endDate && $startDate->diffInDays($endDate, false) >= LetterType::MAX_EVENT_DAYS) {
            $fail('Izin keramaian paling lama '.LetterType::MAX_EVENT_DAYS.' hari.');
        }
    }

    private static function date(mixed $value): ?Carbon
    {
        if (! is_string($value) || ! preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $value)) return null;
        $date = Carbon::createFromFormat('!Y-m-d', $value);

        return $date->format('Y-m-d') === $value ? $date : null;
    }

    /** @return array<string, string|array<string, string>> */
    public static function messages(): array
    {
        return [
            'required' => ':Attribute wajib diisi.',
            'string' => ':Attribute harus berupa teks.',
            'in' => ':Attribute tidak valid. Pilih salah satu pilihan yang tersedia.',
            'min' => ['string' => ':Attribute minimal :min karakter.'],
            'max' => ['string' => ':Attribute maksimal :max karakter.'],
            'regex' => 'Format :attribute tidak valid.',
            'date_format' => ':Attribute harus berupa tanggal yang valid.',
            'prohibited' => ':Attribute tidak dipakai untuk jenis surat ini.',
            'jenis_surat.in' => 'Jenis surat ini tidak dapat diajukan secara online.',
            'nik.regex' => 'NIK harus 16 digit angka.',
            'no_kk.regex' => 'Nomor KK harus 16 digit angka.',
            'rt.regex' => 'RT berisi 1–3 digit angka.',
            'rw.regex' => 'RW berisi 1–3 digit angka.',
            'telepon.regex' => 'Nomor telepon diawali 0 atau +62, 9–14 digit.',
            'tanggal_lahir.after_or_equal' => 'Tanggal lahir paling awal 1 Januari 1900.',
            'tanggal_lahir.before_or_equal' => 'Tanggal lahir tidak boleh melewati hari ini.',
            'tanggal_mulai.after_or_equal' => 'Tanggal mulai tidak boleh sebelum hari ini.',
            'tanggal_selesai.after_or_equal' => 'Tanggal selesai tidak boleh sebelum tanggal mulai.',
        ];
    }

    /** @return array<string, string> */
    public static function attributes(): array
    {
        return [
            'jenis_surat' => 'jenis surat', 'nama' => 'nama', 'nik' => 'NIK', 'no_kk' => 'nomor KK',
            'tempat_lahir' => 'tempat lahir', 'tanggal_lahir' => 'tanggal lahir', 'jenis_kelamin' => 'jenis kelamin',
            'dusun' => 'dusun', 'alamat' => 'alamat', 'rt' => 'RT', 'rw' => 'RW', 'telepon' => 'nomor telepon',
            'kewarganegaraan' => 'kewarganegaraan', 'agama' => 'agama', 'status_perkawinan' => 'status perkawinan',
            'pendidikan' => 'pendidikan', 'pekerjaan' => 'pekerjaan', 'keperluan' => 'keperluan',
            'nama_usaha' => 'nama usaha', 'jenis_usaha' => 'jenis usaha', 'alamat_usaha' => 'alamat usaha',
            'barang_hilang' => 'barang atau dokumen yang hilang', 'acara' => 'acara', 'tempat_acara' => 'tempat acara',
            'tanggal_mulai' => 'tanggal mulai', 'tanggal_selesai' => 'tanggal selesai', 'jenis_hiburan' => 'jenis hiburan',
            'isi_keterangan' => 'isi keterangan',
        ];
    }
}
