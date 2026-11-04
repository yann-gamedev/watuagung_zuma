<?php

namespace App\Domain;

use Illuminate\Support\Facades\Validator;

/** Satu kontrak untuk PUT dan impor. Unknown field ditolak, bukan dibuang diam-diam. */
final class SiteSectionRules
{
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
            if (is_string($value) && preg_match(preg_match('/^data\.blocks\.\d+\.text$/', $field) ? '/(?![\n\r])\p{Cc}/u' : '/\p{Cc}/u', $value)) {
                throw \Illuminate\Validation\ValidationException::withMessages([$field => 'Karakter kontrol tidak diizinkan.']);
            }
        }
    }

    private static function trim(array $data): array
    {
        return array_map(fn ($value) => is_array($value) ? self::trim($value) : (is_string($value) ? trim($value) : $value), $data);
    }
}
