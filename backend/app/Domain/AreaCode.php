<?php

namespace App\Domain;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class AreaCode implements CastsAttributes
{
    public static function normalize(mixed $value): ?string
    {
        if (is_int($value)) $value = (string) $value;
        if (! is_string($value) || ! preg_match('/\A[0-9]{1,3}\z/', $value)) return null;

        return str_pad($value, 3, '0', STR_PAD_LEFT);
    }

    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return self::normalize($value);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        $normalized = self::normalize($value);
        if ($value !== null && $normalized === null) {
            throw ValidationException::withMessages([$key => 'Wilayah harus terdiri dari 1–3 digit.']);
        }

        return $normalized;
    }
}
