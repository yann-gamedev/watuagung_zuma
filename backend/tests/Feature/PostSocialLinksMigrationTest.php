<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PostSocialLinksMigrationTest extends TestCase
{
    // DDL di luar transaksi RefreshDatabase.
    use DatabaseMigrations;

    public function test_down_drops_columns_and_up_defaults_existing_posts_to_off(): void
    {
        $migration = require database_path('migrations/2026_11_22_000000_add_copyright_and_social_links_to_posts.php');
        $migration->down();
        foreach (['show_copyright', 'instagram_url', 'tiktok_url', 'youtube_url', 'facebook_url'] as $column) {
            $this->assertFalse(Schema::hasColumn('posts', $column));
        }
        DB::table('posts')->insert(['slug' => 'lama', 'title' => 'Berita lama fiktif', 'category' => 'pemerintahan',
            'summary' => 'R', 'body' => 'I', 'status' => 'published', 'published_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $migration->up();
        $row = DB::table('posts')->where('slug', 'lama')->first();
        $this->assertEquals(0, $row->show_copyright);
        $this->assertNull($row->instagram_url);
        $this->assertNull($row->facebook_url);
    }
}
