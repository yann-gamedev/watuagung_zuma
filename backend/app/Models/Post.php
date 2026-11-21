<?php

namespace App\Models;

use App\Domain\PostCategory;
use App\Domain\SocialPlatform;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Post extends Model
{
    use SoftDeletes;

    protected $fillable = ['slug', 'title', 'category', 'summary', 'body', 'status', 'published_at', 'created_by', 'updated_by',
        'show_copyright', 'instagram_url', 'tiktok_url', 'youtube_url', 'facebook_url'];

    protected $attributes = ['show_copyright' => false];

    protected function casts(): array {
        return ['category' => PostCategory::class, 'published_at' => 'datetime', 'show_copyright' => 'boolean'];
    }

    /** Tautan yang terisi saja, urut tetap Instagram, TikTok, YouTube, Facebook. @return array<string, string> */
    public function socialLinks(): array {
        $links = [];
        foreach (SocialPlatform::cases() as $platform) {
            $url = $this->{$platform->column()};
            if (is_string($url) && $url !== '') $links[$platform->value] = $url;
        }
        return $links;
    }

    public function scopePublished(Builder $query): void {
        $query->where('status', 'published')->where('published_at', '<=', now());
    }

    /** Foto tambahan, urut posisi. Berita soft-deleted tidak memakai relasi ini saat dibaca publik. */
    public function images(): HasMany {
        return $this->hasMany(PostImage::class)->orderBy('position')->orderBy('id');
    }

    /** Slug unik dari judul, termasuk baris terhapus agar tautan lama tidak berpindah ke berita lain. */
    public static function uniqueSlug(string $title, ?int $ignoreId = null): string {
        // ponytail: dua simpan bersamaan dengan judul sama bisa bentrok di indeks unik (500); tambah retry bila penulis banyak.
        $base = trim(Str::limit(Str::slug($title), 150, ''), '-') ?: 'berita';
        $slug = $base;
        for ($n = 2; static::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists(); $n++) {
            $slug = "{$base}-{$n}";
        }
        return $slug;
    }
}
