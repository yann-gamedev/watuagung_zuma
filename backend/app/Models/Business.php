<?php

namespace App\Models;

use App\Domain\BusinessCategory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/** UMKM warga. Nama pemilik dan WhatsApp terenkripsi; publik hanya bila consent_public_contact. */
class Business extends Model
{
    use SoftDeletes;

    public const HAMLETS = ['Watuagung', 'Talang', 'Sekar'];

    protected $fillable = ['name', 'category', 'description', 'hamlet', 'owner_name', 'whatsapp', 'consent_public_contact', 'status', 'created_by', 'updated_by'];

    protected $attributes = ['consent_public_contact' => false];

    protected function casts(): array {
        return [
            'category' => BusinessCategory::class, 'published_at' => 'datetime', 'consent_public_contact' => 'boolean',
            'owner_name' => 'encrypted', 'whatsapp' => 'encrypted',
        ];
    }

    public function scopePublished(Builder $query): void {
        $query->where('status', 'published')->where('published_at', '<=', now());
    }

    /** Slug unik dari nama, termasuk baris terhapus agar tautan lama tidak berpindah ke usaha lain. */
    public static function uniqueSlug(string $name, ?int $ignoreId = null): string {
        // ponytail: dua simpan bersamaan dengan nama sama bisa bentrok di indeks unik (500); sama seperti Post.
        $base = trim(Str::limit(Str::slug($name), 110, ''), '-') ?: 'umkm';
        $slug = $base;
        for ($n = 2; static::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists(); $n++) {
            $slug = "{$base}-{$n}";
        }
        return $slug;
    }
}
