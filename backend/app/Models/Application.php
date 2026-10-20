<?php

namespace App\Models;

use App\Domain\ApplicationStatus;
use App\Domain\AreaCode;
use App\Domain\LetterType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    protected $guarded = ['id'];
    protected $hidden = ['id', 'lookup_secret_hash', 'nik', 'no_kk', 'telepon', 'alamat', 'alamat_usaha'];
    protected function casts(): array {
        return ['nik' => 'encrypted', 'no_kk' => 'encrypted', 'telepon' => 'encrypted', 'alamat' => 'encrypted', 'alamat_usaha' => 'encrypted', 'tanggal_lahir' => 'date:Y-m-d', 'rt' => AreaCode::class, 'rw' => AreaCode::class];
    }

    public function scopeForUser(Builder $query, User $user): void {
        if (! $user->canAccessPanel()) {
            $query->whereRaw('1 = 0');
        } elseif ($user->isNeighborhoodHead()) {
            // Minimisasi data: RT/RW hanya melihat jenis surat yang memerlukan pengantar mereka.
            $query->whereIn('jenis_surat', LetterType::neighborhoodValues())->where('rw', AreaCode::normalize($user->rw));
            if ($user->role === 'rt_head') $query->where('rt', AreaCode::normalize($user->rt));
        }
    }

    public function isInTerritory(User $user): bool {
        if (! $user->canAccessPanel()) return false;
        if (! $user->isNeighborhoodHead()) return true;

        return LetterType::from($this->jenis_surat)->requiresNeighborhoodApproval()
            && AreaCode::normalize($this->rw) === AreaCode::normalize($user->rw)
            && ($user->role !== 'rt_head' || AreaCode::normalize($this->rt) === AreaCode::normalize($user->rt));
    }

    public function allowedTransitions(User $user): array {
        return $this->isInTerritory($user)
            ? ApplicationStatus::allowedFor($this->status, $user->role, LetterType::from($this->jenis_surat))
            : [];
    }
}
