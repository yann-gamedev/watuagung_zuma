<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Seluruh gambar, metadata EXIF/GPS, berita, dan akun dibuat fiktif. */
class PostCoverTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function requireGd(): void
    {
        if (! extension_loaded('gd')) $this->markTestSkipped('php-gd tidak tersedia; pengujian pemrosesan sampul membutuhkan GD.');
    }

    private function act(string $role = 'staff', array $abilities = ['applications:manage']): User
    {
        $user = User::factory()->create(['role'=>$role, 'rt'=>'001', 'rw'=>'002']);
        Sanctum::actingAs($user, $abilities);
        return $user;
    }

    private function makePost(): Post
    {
        return Post::create([
            'slug'=>'berita-fiktif', 'title'=>'Berita Fiktif', 'category'=>'kegiatan_desa',
            'summary'=>'Ringkasan fiktif.', 'body'=>'Isi fiktif.',
            'status'=>'published', 'published_at'=>now()->subHour(),
        ]);
    }

    private function image(string $extension = 'jpg', int $width = 600, int $height = 400): UploadedFile
    {
        $this->requireGd();
        if ($extension !== 'webp') return UploadedFile::fake()->image('foto.'.$extension, $width, $height);
        if (! function_exists('imagewebp') || ! (imagetypes() & IMG_WEBP)) {
            $this->markTestSkipped('GD tanpa WebP; aktifkan dukungan WebP pada php-gd untuk tes input/output WebP.');
        }
        $image = imagecreatetruecolor($width, $height);
        ob_start();
        imagewebp($image, null, 80);
        $bytes = ob_get_clean();
        imagedestroy($image);
        return UploadedFile::fake()->createWithContent('foto.webp', $bytes);
    }

    private function upload(Post $post, UploadedFile $file)
    {
        return $this->post("/api/v1/staff/posts/{$post->id}/cover", ['file'=>$file], ['Accept'=>'application/json']);
    }

    public function test_gd_has_webp_support(): void
    {
        $this->requireGd();
        if (! function_exists('imagewebp') || ! (imagetypes() & IMG_WEBP)) {
            $this->markTestSkipped('GD tersedia tetapi WebP tidak; unggahan memakai JPEG fallback. Produksi membutuhkan php-gd dengan WebP.');
        }
        $this->assertTrue((bool) gd_info()['WebP Support']);
    }

    public static function formats(): array
    {
        return [['jpg'], ['jpeg'], ['png'], ['webp']];
    }

    #[DataProvider('formats')]
    public function test_upload_reencodes_resizes_and_exposes_only_public_url(string $format): void
    {
        $user = $this->act();
        $post = $this->makePost();
        config(['filesystems.disks.public.url'=>'https://desa.example/media']);
        Storage::fake('public', ['url'=>config('filesystems.disks.public.url')]);
        $response = $this->upload($post, $this->image($format, 2400, 1200))->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonMissingPath('cover_path');
        $path = $post->refresh()->cover_path;
        $webp = function_exists('imagewebp') && (imagetypes() & IMG_WEBP);
        $this->assertMatchesRegularExpression('~^posts/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.'.($webp ? 'webp' : 'jpg').'$~', $path);
        Storage::disk('public')->assertExists($path);
        $info = getimagesizefromstring(Storage::disk('public')->get($path));
        $this->assertSame([1600, 800, $webp ? IMAGETYPE_WEBP : IMAGETYPE_JPEG], array_slice($info, 0, 3));
        $url = 'https://desa.example/media/'.$path;
        $response->assertJsonPath('cover_url', $url);
        $this->getJson('/api/v1/posts')->assertJsonPath('data.0.cover_url', $url)->assertJsonMissingPath('data.0.cover_path');
        $this->getJson('/api/v1/posts/berita-fiktif')->assertJsonPath('cover_url', $url);
        $this->getJson('/api/v1/staff/posts')->assertJsonPath('data.0.cover_url', $url);
        $this->getJson("/api/v1/staff/posts/{$post->id}")->assertJsonPath('cover_url', $url);
        $this->assertSame($user->id, $post->updated_by);
        $audit = (array) DB::table('audit_logs')->sole();
        $this->assertSame('post.updated', $audit['action']);
        $this->assertSame(['id', 'user_id', 'action', 'subject_type', 'subject_id', 'created_at'], array_keys($audit));
    }

    public function test_small_image_is_not_upscaled_and_storage_url_is_supported(): void
    {
        $this->act();
        $post = $this->makePost();
        config(['filesystems.disks.public.url'=>'https://desa.example/storage']);
        Storage::fake('public', ['url'=>config('filesystems.disks.public.url')]);
        $this->upload($post, $this->image())->assertOk();
        $path = $post->refresh()->cover_path;
        $this->assertSame([600, 400], array_slice(getimagesizefromstring(Storage::disk('public')->get($path)), 0, 2));
        $this->getJson('/api/v1/posts/berita-fiktif')->assertJsonPath('cover_url', 'https://desa.example/storage/'.$path);
    }

    public static function invalidFiles(): array
    {
        return [['text'], ['gif'], ['large'], ['narrow'], ['short'], ['wide'], ['tall'], ['corrupt']];
    }

    #[DataProvider('invalidFiles')]
    public function test_invalid_file_returns_422_without_changing_cover(string $case): void
    {
        $this->act();
        $post = $this->makePost();
        $post->forceFill(['cover_path'=>'posts/old.jpg'])->save();
        Storage::disk('public')->put('posts/old.jpg', 'old');
        $file = match ($case) {
            'text'=>UploadedFile::fake()->createWithContent('fake.jpg', '<?php echo "not an image";'),
            'gif'=>$this->image('gif'),
            'large'=>$this->image()->size(3073),
            'narrow'=>$this->image('jpg', 599, 400),
            'short'=>$this->image('jpg', 600, 399),
            'wide'=>$this->image('jpg', 6001, 400),
            'tall'=>$this->image('jpg', 600, 6001),
            'corrupt'=>UploadedFile::fake()->createWithContent('broken.jpg', "\xff\xd8\xff\xe0".str_repeat("\0", 100)),
        };
        $this->upload($post, $file)->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->assertSame('posts/old.jpg', $post->refresh()->cover_path);
        $this->assertSame(['posts/old.jpg'], Storage::disk('public')->allFiles('posts'));
        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public function test_missing_file_returns_422(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->postJson("/api/v1/staff/posts/{$post->id}/cover")->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    public function test_size_and_dimension_boundaries_are_accepted(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post, $this->image('png', 6000, 400)->size(3072))->assertOk();
        $this->upload($post, $this->image('jpg', 600, 6000))->assertOk();
    }

    public function test_reencoding_removes_real_exif_and_fictional_gps(): void
    {
        $file = $this->image('jpg', 1800, 1200);
        if (! function_exists('exif_read_data')) $this->markTestSkipped('Ekstensi exif diperlukan untuk membuktikan fixture JPEG ber-EXIF/GPS.');
        // TIFF little-endian: IFD0 berisi ImageDescription dan pointer GPS; koordinat fiktif 0,0.
        $description = "FIXTURE-FIKTIF\0";
        $gpsOffset = 38 + strlen($description);
        $rationalOffset = $gpsOffset + 54;
        $entry = fn ($tag, $type, $count, $value) => pack('vvVV', $tag, $type, $count, $value);
        $tiff = "II".pack('vV', 42, 8).pack('v', 2)
            .$entry(0x010e, 2, strlen($description), 38).$entry(0x8825, 4, 1, $gpsOffset).pack('V', 0).$description
            .pack('v', 4).$entry(1, 2, 2, ord('N')).$entry(2, 5, 3, $rationalOffset)
            .$entry(3, 2, 2, ord('E')).$entry(4, 5, 3, $rationalOffset + 24).pack('V', 0)
            .str_repeat(pack('VV', 0, 1), 6);
        $exif = "Exif\0\0".$tiff;
        $jpeg = file_get_contents($file->getRealPath());
        $fixture = UploadedFile::fake()->createWithContent('exif-fiktif.jpg', substr($jpeg, 0, 2)."\xff\xe1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2));
        $metadata = exif_read_data($fixture->getRealPath());
        $this->assertSame('FIXTURE-FIKTIF', $metadata['ImageDescription']);
        $this->assertSame(['0/1', '0/1', '0/1'], $metadata['GPSLatitude']);
        $this->assertSame(['0/1', '0/1', '0/1'], $metadata['GPSLongitude']);
        $this->act();
        $post = $this->makePost();
        $this->upload($post, $fixture)->assertOk();
        $bytes = Storage::disk('public')->get($post->refresh()->cover_path);
        $this->assertStringNotContainsString('Exif', $bytes);
        $this->assertStringNotContainsString('EXIF', $bytes);
        $this->assertStringNotContainsString('FIXTURE-FIKTIF', $bytes);
        if (str_ends_with($post->cover_path, '.jpg')) {
            $metadata = exif_read_data(Storage::disk('public')->path($post->cover_path));
            $this->assertArrayNotHasKey('GPSLatitude', $metadata);
            $this->assertArrayNotHasKey('ImageDescription', $metadata);
        }
    }

    public function test_staff_and_admin_can_replace_and_delete_cover(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post, $this->image())->assertOk();
        $old = $post->refresh()->cover_path;
        $this->act('admin');
        $this->upload($post, $this->image('png'))->assertOk();
        $new = $post->refresh()->cover_path;
        $this->assertNotSame($old, $new);
        Storage::disk('public')->assertMissing($old)->assertExists($new);
        $this->deleteJson("/api/v1/staff/posts/{$post->id}/cover")->assertOk()->assertJsonPath('cover_url', null);
        Storage::disk('public')->assertMissing($new);
        $this->assertNull($post->refresh()->cover_path);
        $this->deleteJson("/api/v1/staff/posts/{$post->id}/cover")->assertOk()->assertJsonPath('cover_url', null);
    }

    public function test_soft_delete_keeps_file_and_restore_keeps_cover(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post, $this->image())->assertOk();
        $path = $post->refresh()->cover_path;
        $this->deleteJson("/api/v1/staff/posts/{$post->id}")->assertOk();
        Storage::disk('public')->assertExists($path);
        $this->upload($post, $this->image())->assertNotFound();
        $this->deleteJson("/api/v1/staff/posts/{$post->id}/cover")->assertNotFound();
        $post->refresh()->restore();
        $this->getJson('/api/v1/posts/berita-fiktif')->assertOk()->assertJsonPath('cover_url', Storage::disk('public')->url($path));
    }

    public static function forbiddenRoles(): array
    {
        return [['village_head'], ['rt_head'], ['rw_head']];
    }

    #[DataProvider('forbiddenRoles')]
    public function test_wrong_roles_get_403_before_validation_or_lookup(string $role): void
    {
        $this->act($role);
        $this->postJson('/api/v1/staff/posts/999/cover')->assertForbidden();
        $this->deleteJson('/api/v1/staff/posts/999/cover')->assertForbidden();
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public function test_token_ability_and_active_account_are_required(): void
    {
        $this->postJson('/api/v1/staff/posts/999/cover')->assertUnauthorized();
        $this->deleteJson('/api/v1/staff/posts/999/cover')->assertUnauthorized();
        $this->act('staff', ['other']);
        $this->postJson('/api/v1/staff/posts/999/cover')->assertForbidden();
        $this->deleteJson('/api/v1/staff/posts/999/cover')->assertForbidden();
        $user = $this->act();
        $user->forceFill(['is_active'=>false])->save();
        $this->postJson('/api/v1/staff/posts/999/cover')->assertForbidden();
        $this->deleteJson('/api/v1/staff/posts/999/cover')->assertForbidden();
    }

    public function test_cover_mutations_share_limit_of_ten_per_minute(): void
    {
        $this->act();
        $post = $this->makePost();
        $url = "/api/v1/staff/posts/{$post->id}/cover";
        for ($i = 0; $i < 5; $i++) {
            $this->postJson($url)->assertUnprocessable();
            $this->deleteJson($url)->assertOk();
        }
        $this->postJson($url)->assertTooManyRequests();
        $this->deleteJson($url)->assertTooManyRequests();
        $this->travel(61)->seconds();
        $this->deleteJson($url)->assertOk();
    }

    public function test_database_failure_keeps_old_file_and_removes_new_file(): void
    {
        $this->act();
        $post = $this->makePost();
        $this->upload($post, $this->image())->assertOk();
        $old = $post->refresh()->cover_path;
        Post::saving(function (Post $post) {
            if ($post->isDirty('cover_path')) throw new \RuntimeException('Simulasi gagal simpan.');
        });
        try {
            $this->upload($post, $this->image())->assertStatus(500);
            $this->deleteJson("/api/v1/staff/posts/{$post->id}/cover")->assertStatus(500);
        } finally {
            Post::flushEventListeners();
        }
        $this->assertSame($old, $post->refresh()->cover_path);
        $this->assertSame([$old], Storage::disk('public')->allFiles());
        $this->assertSame(1, DB::table('audit_logs')->count());
    }
}
