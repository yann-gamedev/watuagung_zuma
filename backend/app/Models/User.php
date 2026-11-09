<?php
namespace App\Models;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Domain\ApplicationStatus;
use App\Domain\AreaCode;
use Database\Factories\UserFactory;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
#[Fillable(['name', 'username', 'email', 'password', 'role', 'rt', 'rw', 'is_active', 'must_change_password', 'last_login_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable {
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;
    /** Default aman sebelum baris disimpan; migration juga memberi default yang sama. */
    protected $attributes = ['is_active' => true, 'must_change_password' => false];
    /** Get the attributes that should be cast.
     * @return array<string, string>
     */
    protected function casts(): array {
        return ['email_verified_at'=>'datetime','password'=>'hashed','rt'=>AreaCode::class,'rw'=>AreaCode::class,'is_active'=>'boolean','must_change_password'=>'boolean','last_login_at'=>'datetime'];
    }

    protected static function booted(): void {
        static::saving(function (User $user) {
            if (! $user->hasValidTerritory()) {
                throw ValidationException::withMessages(['rw' => 'Ketua RT memerlukan RT dan RW; Ketua RW memerlukan RW yang valid.']);
            }
        });
    }

    public function isNeighborhoodHead(): bool {
        return in_array($this->role, ['rt_head', 'rw_head'], true);
    }

    public function hasValidTerritory(): bool {
        return match ($this->role) {
            'rt_head' => AreaCode::normalize($this->rt) !== null && AreaCode::normalize($this->rw) !== null,
            'rw_head' => AreaCode::normalize($this->rw) !== null,
            default => true,
        };
    }

    /** Ability token Sanctum => peran. `panel` dimiliki semua peran panel aktif. */
    private const ABILITY_ROLES = [
        'applications:manage' => ['staff', 'admin', 'village_head', 'rt_head', 'rw_head'],
        'media:manage' => ['admin', 'staff', 'kim'],
        'site:manage' => ['admin', 'staff'],
    ];

    /** Satu-satunya sumber ability per peran: dipakai saat login, /me, dan pemeriksaan controller. */
    public function abilities(): array {
        if (! $this->canAccessPanel()) return [];
        $granted = array_keys(array_filter(self::ABILITY_ROLES, fn (array $roles) => in_array($this->role, $roles, true)));
        return ['panel', ...$granted];
    }

    public function hasPanelAbility(string $ability): bool {
        return in_array($ability, $this->abilities(), true);
    }

    /** Layanan surat: permohonan, ringkasan, register, PDF, kode akses. KIM tidak termasuk. */
    public function canManageApplications(): bool {
        return $this->hasPanelAbility('applications:manage');
    }

    /** Buat ulang kode akses: semua peran layanan surat kecuali kepala desa; wilayah dibatasi lewat Application::forUser. */
    public function canResetAccessCode(): bool {
        return $this->canManageApplications() && $this->role !== 'village_head';
    }

    /** Berita dan UMKM: admin, staff, kim. */
    public function canManageMedia(): bool {
        return $this->hasPanelAbility('media:manage');
    }

    /** Konten desa (site_sections): admin, staff. */
    public function canManageContent(): bool {
        return $this->hasPanelAbility('site:manage');
    }

    public function canAccessPanel(): bool {
        // Akun nonaktif langsung ditolak walau token lamanya belum tercabut.
        return $this->is_active && ApplicationStatus::isPanelRole($this->role) && $this->hasValidTerritory()
            && (! $this->isNeighborhoodHead() || config('letters.neighborhood_approval', false));
    }
}

