<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Berita, UMKM, dan file foto di sini fiktif (isi file bukan gambar sungguhan). */
class MediaPruneTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function file(string $path, bool $old = true): string
    {
        Storage::disk('public')->put($path, 'foto-fiktif');
        if ($old) touch(Storage::disk('public')->path($path), now()->subHours(2)->getTimestamp());
        return $path;
    }

    private function makePost(string $slug, ?string $cover): Post
    {
        $post = Post::create(['slug' => $slug, 'title' => 'Berita Fiktif', 'category' => 'kegiatan_desa', 'summary' => 'Ringkasan fiktif.', 'body' => 'Isi fiktif.', 'status' => 'draft']);
        $post->forceFill(['cover_path' => $cover])->save();
        return $post;
    }

    private function business(string $slug, ?string $photo): Business
    {
        $business = new Business(['name' => 'Usaha Fiktif', 'category' => 'kerajinan', 'description' => 'Deskripsi fiktif.', 'owner_name' => 'Pemilik Fiktif', 'consent_public_contact' => false, 'status' => 'draft']);
        $business->forceFill(['slug' => $slug, 'photo_path' => $photo])->save();
        return $business;
    }

    public function test_prune_removes_orphans_and_keeps_active_and_recent_files(): void
    {
        $active = $this->file('posts/aktif.webp');
        $this->makePost('aktif', $active);
        $trashedCover = $this->file('posts/terhapus.webp');
        $trashed = $this->makePost('terhapus', $trashedCover);
        $trashed->delete();
        $orphan = $this->file('posts/yatim.webp');
        $recent = $this->file('posts/baru.webp', old: false);

        $activePhoto = $this->file('businesses/aktif.jpg');
        $this->business('aktif', $activePhoto);
        $trashedPhoto = $this->file('businesses/terhapus.jpg');
        $this->business('terhapus', $trashedPhoto)->delete();
        // Folder lain (mis. konten situs) tidak disentuh.
        $site = $this->file('site/structure/lain.webp');

        $this->artisan('media:prune --dry-run')->expectsOutputToContain('[dry-run] 3 file akan dihapus')->assertSuccessful();
        foreach ([$trashedCover, $orphan, $trashedPhoto] as $path) Storage::disk('public')->assertExists($path);
        $this->assertSame($trashedCover, Post::withTrashed()->find($trashed->id)->cover_path);

        $this->artisan('media:prune')->expectsOutputToContain('3 file foto yatim dihapus')->assertSuccessful();
        Storage::disk('public')->assertMissing([$trashedCover, $orphan, $trashedPhoto])->assertExists([$active, $recent, $activePhoto, $site]);
        $this->assertNull(Post::withTrashed()->find($trashed->id)->cover_path);
        $this->assertSame(0, Business::onlyTrashed()->whereNotNull('photo_path')->count());

        $this->artisan('media:prune')->expectsOutputToContain('0 file foto yatim dihapus')->assertSuccessful();
    }
}
