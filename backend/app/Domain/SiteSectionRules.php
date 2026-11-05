<?php

namespace App\Domain;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/** Satu kontrak untuk PUT dan impor. Unknown field ditolak, bukan dibuang diam-diam. */
final class SiteSectionRules
{
    /** Lima bidang belanja APBDes; urutan sama dengan SPENDING_FIELDS di lib/transparency.ts. */
    public const SPENDING_FIELDS = [
        'Penyelenggaraan Pemerintahan Desa',
        'Pelaksanaan Pembangunan',
        'Pembinaan Kemasyarakatan',
        'Pemberdayaan Masyarakat',
        'Penanggulangan Bencana, Keadaan Darurat, dan Mendesak',
    ];

    public const DOCUMENT_PATH = '/\Asite\/documents\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf\z/';

    public static function validate(SiteSection $section, array $input): array
    {
        $text = fn (int $max) => ['required', 'string', "max:$max"];
        $rules = [
            'payload' => ['required', 'array:data'],
            'payload.data' => ['required', $section === SiteSection::Profile ? 'array:intro,blocks,profileDetails' : 'array:intro,blocks'],
            'payload.data.intro' => $text(2000),
            'payload.data.blocks' => ['required', 'array', 'list', 'min:1', 'max:20'],
            'payload.data.blocks.*' => ['required', 'array:title,text'],
            'payload.data.blocks.*.title' => $text(160),
            'payload.data.blocks.*.text' => $text(10000),
        ];
        if ($section === SiteSection::Profile && is_array($input['data'] ?? null) && array_key_exists('profileDetails', $input['data'])) {
            $rules += [
                'payload.data.profileDetails' => ['required', 'array:themes,stats,location,boundaries,institutions,source'],
                'payload.data.profileDetails.themes' => ['present', 'array', 'list', 'max:6'],
                'payload.data.profileDetails.themes.*' => $text(160),
                'payload.data.profileDetails.stats' => ['present', 'array', 'list', 'max:6'],
                'payload.data.profileDetails.stats.*' => ['required', 'array:value,label,detail'],
                'payload.data.profileDetails.stats.*.value' => $text(160),
                'payload.data.profileDetails.stats.*.label' => $text(160),
                'payload.data.profileDetails.stats.*.detail' => ['sometimes', ...$text(1000)],
                'payload.data.profileDetails.location' => $text(1000),
                'payload.data.profileDetails.boundaries' => ['required', 'array', 'list', 'size:4'],
                'payload.data.profileDetails.boundaries.*' => ['required', 'array:direction,place'],
                'payload.data.profileDetails.boundaries.*.place' => $text(1000),
                'payload.data.profileDetails.institutions' => ['present', 'array', 'list', 'max:20'],
                'payload.data.profileDetails.institutions.*' => ['required', 'array:name,description'],
                'payload.data.profileDetails.institutions.*.name' => $text(160),
                'payload.data.profileDetails.institutions.*.description' => $text(2000),
                'payload.data.profileDetails.source' => $text(1000),
            ];
            foreach (['Utara', 'Timur', 'Selatan', 'Barat'] as $index => $direction) {
                $rules["payload.data.profileDetails.boundaries.$index.direction"] = ['required', 'string', "in:$direction"];
            }
        }
        if ($section === SiteSection::Contact) {
            $rules = [
                'payload' => ['required', 'array:data'],
                'payload.data' => ['required', 'array:address,hours,contactName,phone,mapsEmbedUrl,mapsLinkUrl'],
                'payload.data.address' => $text(1000),
                'payload.data.hours' => $text(200),
                'payload.data.contactName' => $text(160),
                'payload.data.phone' => ['present', 'string', 'max:15', 'not_regex:/\p{Cc}/u', 'regex:/\A(?:|\[PLACEHOLDER\]|62[0-9]{1,13})\z/'],
                'payload.data.mapsEmbedUrl' => self::mapUrl(['https://www.google.com/maps/embed?']),
                'payload.data.mapsLinkUrl' => self::mapUrl(['https://maps.app.goo.gl/', 'https://www.google.com/maps/']),
            ];
        } elseif ($section === SiteSection::Transparency) {
            $budget = 'payload.data.budgets.*';
            $amount = ['required', 'integer:strict', 'between:0,100000000000'];
            // Total sengaja tidak ada di skema: dihitung frontend (lib/transparency.ts) dari rincian.
            $rules = [
                'payload' => ['required', 'array:data'],
                'payload.data' => ['required', 'array:intro,programs,budgets'],
                'payload.data.intro' => $text(2000),
                'payload.data.programs' => ['required', 'array', 'list', 'min:1', 'max:20'],
                'payload.data.programs.*' => ['required', 'array:title,text'],
                'payload.data.programs.*.title' => $text(160),
                'payload.data.programs.*.text' => $text(10000),
                'payload.data.budgets' => ['present', 'array', 'list', 'max:5'],
                $budget => ['required', 'array:year,status,revenue,spending,financing,source,documentPath'],
                "$budget.year" => ['required', 'integer:strict', 'between:2000,2099', 'distinct:strict'],
                "$budget.status" => ['required', 'string', 'in:Rancangan,Ditetapkan,Perubahan'],
                "$budget.revenue" => ['required', 'array', 'list', 'min:1', 'max:20'],
                "$budget.spending" => ['required', 'array', 'list', 'size:5'],
                "$budget.financing" => ['sometimes', 'array', 'list', 'max:10'],
                "$budget.source" => $text(1000),
                "$budget.documentPath" => ['sometimes', 'bail', 'required', 'string', 'regex:'.self::DOCUMENT_PATH, function ($attribute, $value, $fail) {
                    if (! Storage::disk('public')->exists($value)) $fail('Dokumen belum diunggah.');
                }],
            ];
            foreach (['revenue', 'spending', 'financing'] as $list) {
                $rules["$budget.$list.*"] = ['required', 'array:label,amount'];
                $rules["$budget.$list.*.label"] = $text(160);
                $rules["$budget.$list.*.amount"] = $amount;
            }
            foreach (self::SPENDING_FIELDS as $index => $label) {
                $rules["$budget.spending.$index.label"] = ['required', 'string', Rule::in([$label])];
            }
        } elseif (! in_array($section, [SiteSection::Profile, SiteSection::History], true)) {
            // ponytail: R5–R8 menentukan skema; bahkan objek kosong belum boleh disimpan.
            throw \Illuminate\Validation\ValidationException::withMessages(['data' => 'Bagian ini belum dapat diisi.']);
        }

        // Cek kontrol sebelum trim agar NUL/tab di tepi tidak hilang sebelum ditolak.
        self::rejectControls($input);
        $input = self::trim($input);
        $validator = Validator::make(['payload' => $input], $rules);
        if ($validator->fails()) {
            $errors = [];
            foreach ($validator->errors()->messages() as $field => $messages) {
                $field = $field === 'payload' ? 'data' : substr($field, 8);
                $errors[$field] = array_merge($errors[$field] ?? [], $messages);
            }
            throw \Illuminate\Validation\ValidationException::withMessages($errors);
        }
        return $input['data'];
    }

    private static function mapUrl(array $prefixes): array
    {
        return ['bail', 'present', 'string', 'max:2048', 'not_regex:/\p{Cc}/u', function ($attribute, $value, $fail) use ($prefixes) {
            $value = trim($value);
            if ($value === '' || $value === '[PLACEHOLDER]') return;
            if (filter_var($value, FILTER_VALIDATE_URL) !== false) {
                foreach ($prefixes as $prefix) if (str_starts_with($value, $prefix)) return;
            }
            $fail('Gunakan URL Google Maps yang diizinkan.');
        }];
    }

    private static function rejectControls(array $data, string $path = ''): void
    {
        foreach ($data as $key => $value) {
            $field = $path === '' ? (string) $key : "$path.$key";
            if (is_array($value)) self::rejectControls($value, $field);
            if (is_string($value) && preg_match(preg_match('/^data\.(?:blocks|programs)\.\d+\.text$/', $field) ? '/(?![\n\r])\p{Cc}/u' : '/\p{Cc}/u', $value)) {
                throw \Illuminate\Validation\ValidationException::withMessages([$field => 'Karakter kontrol tidak diizinkan.']);
            }
        }
    }

    private static function trim(array $data): array
    {
        return array_map(fn ($value) => is_array($value) ? self::trim($value) : (is_string($value) ? trim($value) : $value), $data);
    }
}
