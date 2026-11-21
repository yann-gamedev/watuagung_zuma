<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Berita, foto, dan akun di sini fiktif. */
class PostImagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function act(string $role = 'staff', ?array $abilities = null): User
    {
        $user = User::factory()->create(['role'=>$role, 'rt'=>'001', 'rw'=>'002']);
        Sanctum::actingAs($user, $abilities ?? $user->abilities());
        return $user;
    }

    private function makePost(string $slug = 'berita-foto-fiktif'): Post
    {
        return Post::create([
            'slug'=>$slug, 'title'=>'Berita Foto Fiktif', 'category'=>'kegiatan_desa',
            'summary'=>'Ringkasan fiktif.', 'body'=>"Paragraf pertama.\n\nParagraf kedua.\n\nParagraf ketiga.",
            'status'=>'published', 'published_at'=>now()->subHour(),
        ]);
    }

    private function image(int $width = 1200, int $height = 800): UploadedFile
    {
        if (! extension_loaded('gd')) $this->markTestSkipped('php-gd diperlukan untuk tes foto tambahan.');
        if (! function_exists('imagejpeg')) $this->markTestSkipped('GD tanpa JPEG diperlukan untuk fixture foto.');
        return UploadedFile::fake()->image('foto-fiktif.jpg', $width, $height);
    }

    private function upload(Post $post, ?string $caption = null, ?UploadedFile $file = null)
    {
        return $this->post("/api/v1/staff/posts/{$post->id}/images", array_filter([
            'file'=>$file ?? $this->image(), 'caption'=>$caption,
        ], fn ($value) => $value !== null), ['Accept'=>'application/json']);
    }

    public function test_upload_three_images_and_reject_fourth(): void
    {
        $this->act();
        $post = $this->makePost();
        $paths = [];
        foreach (['Foto pertama.', 'Foto kedua.', null] as $caption) {
            $response = $this->upload($post, $caption)->assertOk()->assertJsonMissingPath('images.0.path');
            $paths[] = PostImage::where('post_id', $post->id)->latest('id')->first()->path;
        }
        $detail = $this->getJson("/api/v1/staff/posts/{$post->id}")->assertOk()->assertJsonCount(3, 'images');
        $this->assertSame(['Foto pertama.', 'Foto kedua.', null], array_column($detail->json('images'), 'caption'));
        $this->assertSame([1, 2, 3], PostImage::where('post_id', $post->id)->orderBy('position')->pluck('position')->all());
        $this->getJson('/api/v1/posts/berita-foto-fiktif')->assertOk()->assertJsonCount(3, 'images')
            ->assertJsonPath('images.0.url', Storage::disk('public')->url($paths[0]));

        $this->upload($post, 'Foto keempat.')->assertUnprocessable()
            ->assertJsonPath('errors.file.0', 'Maksimal 3 foto tambahan per berita.');
        $this->assertSame(3, PostImage::where('post_id', $post->id)->count());
        // File unggahan keempat dibersihkan, bukan tertinggal sebagai yatim.
        $this->assertSame(3, count(Storage::disk('public')->files('posts')));
    }

    public function test_public_detail_has_url_and_caption_only_and_list_has_no_images(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post, 'Warga berdiskusi di balai desa.')->assertOk();
        $detail = $this->getJson('/api/v1/posts/berita-foto-fiktif')->assertOk()
            ->assertJsonCount(1, 'images')->assertJsonPath('images.0.caption', 'Warga berdiskusi di balai desa.');
        $this->assertSame(['url', 'caption'], array_keys($detail->json('images.0')));
        $this->getJson('/api/v1/posts')->assertOk()->assertJsonMissingPath('data.0.images');
    }

    public function test_caption_can_be_updated_and_cleared(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post)->assertOk();
        $image = PostImage::where('post_id', $post->id)->sole();
        $this->patchJson("/api/v1/staff/posts/{$post->id}/images/{$image->id}", ['caption'=>'  Keterangan baru.  '])
            ->assertOk()->assertJsonPath('images.0.caption', 'Keterangan baru.');
        $this->patchJson("/api/v1/staff/posts/{$post->id}/images/{$image->id}", ['caption'=>null])
            ->assertOk()->assertJsonPath('images.0.caption', null);
        $this->patchJson("/api/v1/staff/posts/{$post->id}/images/{$image->id}", ['caption'=>str_repeat('a', 201)])
            ->assertUnprocessable()->assertJsonValidationErrors('caption');
        $this->patchJson("/api/v1/staff/posts/{$post->id}/images/{$image->id}", ['caption'=>"baris\nbaru"])
            ->assertUnprocessable()->assertJsonValidationErrors('caption');
    }

    public function test_delete_image_removes_file_and_keeps_remaining_order(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post, 'Satu.')->assertOk();
        $this->upload($post, 'Dua.')->assertOk();
        $this->upload($post, 'Tiga.')->assertOk();
        $rows = PostImage::where('post_id', $post->id)->orderBy('position')->get();
        $middle = $rows[1];
        $this->deleteJson("/api/v1/staff/posts/{$post->id}/images/{$middle->id}")->assertOk()->assertJsonCount(2, 'images');
        Storage::disk('public')->assertMissing($middle->path);
        $this->assertSame(['Satu.', 'Tiga.'], array_column($this->getJson("/api/v1/staff/posts/{$post->id}")->json('images'), 'caption'));

        $this->upload($post, 'Empat.')->assertOk();
        $this->assertSame(['Satu.', 'Tiga.', 'Empat.'], array_column($this->getJson("/api/v1/staff/posts/{$post->id}")->json('images'), 'caption'));
        // Foto milik berita lain tidak dapat diubah lewat ID berita ini.
        $other = $this->makePost('berita-lain');
        $this->deleteJson("/api/v1/staff/posts/{$other->id}/images/{$rows[0]->id}")->assertNotFound();
    }

    public function test_delete_post_removes_inline_image_rows_and_files(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post, 'Satu.')->assertOk();
        $this->upload($post, 'Dua.')->assertOk();
        $paths = PostImage::where('post_id', $post->id)->pluck('path')->all();
        $this->deleteJson("/api/v1/staff/posts/{$post->id}")->assertOk();
        Storage::disk('public')->assertMissing($paths);
        $this->assertSame(0, PostImage::where('post_id', $post->id)->count());
        $this->assertSoftDeleted('posts', ['id'=>$post->id]);
        $this->getJson('/api/v1/posts/berita-foto-fiktif')->assertNotFound();
    }

    public function test_upload_validates_file_size_and_post_id(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post, null, $this->image()->size(10241))->assertUnprocessable()
            ->assertJsonPath('errors.file.0', 'Ukuran foto maksimal 10 MB.');
        $this->post('/api/v1/staff/posts/999/images', ['file'=>$this->image()], ['Accept'=>'application/json'])->assertNotFound();
        $this->assertSame([], Storage::disk('public')->allFiles('posts'));
        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public static function forbiddenRoles(): array
    {
        return [['village_head'], ['rt_head'], ['rw_head']];
    }

    #[DataProvider('forbiddenRoles')]
    public function test_wrong_roles_get_403_before_validation(string $role): void
    {
        $this->act($role);
        $post = $this->makePost();
        $this->postJson("/api/v1/staff/posts/{$post->id}/images")->assertForbidden();
        $this->patchJson("/api/v1/staff/posts/{$post->id}/images/1", ['caption'=>null])->assertForbidden();
        $this->deleteJson("/api/v1/staff/posts/{$post->id}/images/1")->assertForbidden();
        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public function test_token_and_ability_are_required(): void
    {
        $post = $this->makePost();
        $this->postJson("/api/v1/staff/posts/{$post->id}/images")->assertUnauthorized();
        $this->act('staff', ['other']);
        $this->postJson("/api/v1/staff/posts/{$post->id}/images")->assertForbidden();
        $this->patchJson("/api/v1/staff/posts/{$post->id}/images/1", ['caption'=>null])->assertForbidden();
    }
}
