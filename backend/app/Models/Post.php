<?php

namespace App\Models;

use App\Domain\PostCategory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Post extends Model
{
    use SoftDeletes;

    protected $fillable = ['slug', 'title', 'category', 'summary', 'body', 'status', 'published_at', 'created_by', 'updated_by'];

    protected function casts(): array {
        return ['category' => PostCategory::class, 'published_at' => 'datetime'];
    }

    public function scopePublished(Builder $query): void {
        $query->where('status', 'published')->where('published_at', '<=', now());
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
