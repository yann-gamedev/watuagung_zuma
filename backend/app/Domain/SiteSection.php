<?php

namespace App\Domain;

/** Visi-misi tetap statis di lib/data.ts (keputusan 3 November 2026). */
enum SiteSection: string
{
    case Profile = 'profile';
    case Contact = 'contact';
    case History = 'history';
    case Statistics = 'statistics';
    case Transparency = 'transparency';
    case Structure = 'structure';
    case Videos = 'videos';

    public function allowsImages(): bool
    {
        return $this === self::Structure;
    }

    public function allowsDocuments(): bool
    {
        return $this === self::Transparency;
    }
}
