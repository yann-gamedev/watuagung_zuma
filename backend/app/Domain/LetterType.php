<?php

namespace App\Domain;

enum LetterType: string
{
    case Sku = 'SKU';
    case Domisili = 'DOMISILI';
    case Sktm = 'SKTM';
    case KtpKk = 'KTP_KK';

    public function requiresNeighborhoodApproval(): bool
    {
        return match ($this) {
            self::Domisili, self::Sktm, self::KtpKk => true,
            self::Sku => false,
        };
    }

    /** @return list<string> */
    public static function neighborhoodValues(): array
    {
        return array_values(array_map(fn (self $type) => $type->value, array_filter(self::cases(), fn (self $type) => $type->requiresNeighborhoodApproval())));
    }
}
