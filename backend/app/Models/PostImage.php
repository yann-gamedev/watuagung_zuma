<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Foto tambahan di dalam berita. File publik, bukan tempat dokumen pribadi. */
class PostImage extends Model
{
    protected $fillable = ['post_id', 'path', 'caption', 'position'];

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
