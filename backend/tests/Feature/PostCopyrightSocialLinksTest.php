<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Hak cipta KIM dan tautan media sosial opsional per berita. Berita, akun, dan tautan fiktif. */
class PostCopyrightSocialLinksTest extends TestCase
{
    use RefreshDatabase;

    private const LINKS = [
        'instagram_url' => 'https://www.instagram.com/p/FIKTIF123/',
        'tiktok_url' => 'https://www.tiktok.com/@desafiktif/video/123',
        'youtube_url' => 'https://youtu.be/FIKTIF',
        'facebook_url' => 'https://www.facebook.com/desafiktif/posts/1',
    ];

    private function act(string $role = 'kim'): User
    {
        $user = User::factory()->create(['role' => $role]);
        Sanctum::actingAs($user, $user->abilities());
        return $user;
    }

    private function payload(array $override = []): array
    {
        return array_replace([
            'title' => 'Kerja Bakti Fiktif', 'category' => 'kegiatan_desa',
            'summary' => 'Ringkasan fiktif.', 'body' => 'Isi fiktif.', 'status' => 'published',
        ], $override);
    }

    public function test_defaults_are_off_and_empty(): void
    {
        $this->act();
        $created = $this->postJson('/api/v1/staff/posts', $this->payload())->assertCreated()
            ->assertJsonPath('show_copyright', false);
        foreach (array_keys(self::LINKS) as $column) $created->assertJsonPath($column, null);

        $public = $this->getJson('/api/v1/posts/'.$created->json('slug'))->assertOk()->assertJsonPath('show_copyright', false);
        // Objek kosong, bukan array, agar skema klien tetap satu bentuk.
        $this->assertStringContainsString('"social_links":{}', $public->getContent());
    }

    public function test_kim_saves_copyright_and_links_and_public_detail_shows_only_filled_links(): void
    {
        $this->act('kim');
        $created = $this->postJson('/api/v1/staff/posts', $this->payload(['show_copyright' => true] + self::LINKS))->assertCreated()
            ->assertJsonPath('show_copyright', true)
            ->assertJsonPath('instagram_url', self::LINKS['instagram_url']);
        $id = $created->json('id');
        $slug = $created->json('slug');

        $this->getJson("/api/v1/posts/$slug")->assertOk()
            ->assertJsonPath('show_copyright', true)
            ->assertJsonPath('social_links', [
                'instagram' => self::LINKS['instagram_url'], 'tiktok' => self::LINKS['tiktok_url'],
                'youtube' => self::LINKS['youtube_url'], 'facebook' => self::LINKS['facebook_url'],
            ]);

        // Mengosongkan satu kolom (string kosong → null) dan mematikan hak cipta.
        $this->patchJson("/api/v1/staff/posts/$id", ['tiktok_url' => '', 'youtube_url' => null, 'show_copyright' => false])->assertOk()
            ->assertJsonPath('tiktok_url', null)->assertJsonPath('youtube_url', null)->assertJsonPath('show_copyright', false);
        $this->getJson("/api/v1/posts/$slug")->assertOk()
            ->assertJsonPath('social_links', ['instagram' => self::LINKS['instagram_url'], 'facebook' => self::LINKS['facebook_url']]);

        // Update tanpa kolom baru tidak menghapus nilai lama.
        $this->patchJson("/api/v1/staff/posts/$id", ['title' => 'Judul Fiktif Baru'])->assertOk()
            ->assertJsonPath('instagram_url', self::LINKS['instagram_url']);
    }

    public function test_public_list_does_not_include_new_fields(): void
    {
        Post::create(['slug' => 'terbit', 'title' => 'Fiktif', 'category' => 'pemerintahan', 'summary' => 'R', 'body' => 'I',
            'status' => 'published', 'published_at' => now()->subHour(), 'show_copyright' => true] + self::LINKS);
        $this->assertSame(['slug', 'title', 'category', 'category_label', 'summary', 'published_at', 'cover_url'],
            array_keys($this->getJson('/api/v1/posts')->assertOk()->json('data.0')));
    }

    public function test_draft_links_are_not_public(): void
    {
        Post::create(['slug' => 'draf', 'title' => 'Fiktif', 'category' => 'pemerintahan', 'summary' => 'R', 'body' => 'I',
            'status' => 'draft'] + self::LINKS);
        $this->getJson('/api/v1/posts/draf')->assertNotFound();
    }

    /** @return array<string, array{string, mixed}> */
    public static function invalidLinks(): array
    {
        return [
            'http' => ['instagram_url', 'http://www.instagram.com/p/FIKTIF/'],
            'javascript' => ['facebook_url', 'javascript:alert(1)'],
            'data' => ['youtube_url', 'data:text/html,halo'],
            'wrong platform' => ['instagram_url', 'https://www.tiktok.com/@desafiktif'],
            'lookalike host' => ['facebook_url', 'https://facebook.com.contoh-fiktif.test/'],
            'subdomain trick' => ['youtube_url', 'https://youtube.com@contoh-fiktif.test/'],
            'other port' => ['tiktok_url', 'https://www.tiktok.com:8443/@desafiktif'],
            'no scheme' => ['instagram_url', 'instagram.com/desafiktif'],
            'too long' => ['youtube_url', 'https://youtu.be/'.str_repeat('a', 490)],
            'control char' => ['tiktok_url', "https://www.tiktok.com/@desa\x07fiktif"],
            'not string' => ['facebook_url', ['https://www.facebook.com/']],
            'copyright not boolean' => ['show_copyright', 'ya'],
        ];
    }

    #[DataProvider('invalidLinks')]
    public function test_invalid_values_are_rejected_with_422(string $field, mixed $value): void
    {
        $this->act('staff');
        $this->postJson('/api/v1/staff/posts', $this->payload([$field => $value]))->assertUnprocessable()->assertJsonValidationErrors([$field]);
        $this->assertSame(0, Post::count());
    }

    public function test_accepts_mobile_and_short_hosts(): void
    {
        $this->act('admin');
        $this->postJson('/api/v1/staff/posts', $this->payload([
            'instagram_url' => 'https://instagram.com/reel/FIKTIF', 'tiktok_url' => 'https://vt.tiktok.com/FIKTIF/',
            'youtube_url' => 'https://m.youtube.com/watch?v=FIKTIF', 'facebook_url' => 'https://fb.watch/FIKTIF/',
        ]))->assertCreated();
    }

    public function test_other_roles_cannot_set_fields(): void
    {
        $this->act('village_head');
        $this->postJson('/api/v1/staff/posts', $this->payload(self::LINKS))->assertForbidden();
        $this->postJson('/api/v1/staff/posts', $this->payload(self::LINKS))->assertForbidden();
        $this->assertSame(0, DB::table('posts')->count());
    }
}
