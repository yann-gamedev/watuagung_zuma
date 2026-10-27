<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Berita dan akun di sini fiktif. */
class PostsApiTest extends TestCase
{
    use RefreshDatabase;

    private function act(string $role = 'staff', array $abilities = ['applications:manage']): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002']);
        Sanctum::actingAs($user, $abilities);
        return $user;
    }

    private function payload(array $override = []): array
    {
        return array_replace([
            'title' => 'Kerja Bakti Fiktif', 'category' => 'kegiatan_desa',
            'summary' => 'Ringkasan fiktif.', 'body' => "Paragraf satu.\n\nParagraf dua.", 'status' => 'draft',
        ], $override);
    }

    private function makePost(array $attributes = []): Post
    {
        return Post::create(array_replace([
            'slug' => 'berita-'.uniqid(), 'title' => 'Berita Fiktif', 'category' => 'pemerintahan',
            'summary' => 'Ringkasan fiktif.', 'body' => 'Isi fiktif.', 'status' => 'published', 'published_at' => now()->subHour(),
        ], $attributes));
    }

    private function auditActions(int $postId): array
    {
        return DB::table('audit_logs')->where('subject_type', 'post')->where('subject_id', $postId)->orderBy('id')->pluck('action')->all();
    }

    public function test_public_list_shows_only_published_newest_first_with_safe_fields(): void
    {
        $old = $this->makePost(['slug' => 'lama', 'published_at' => now()->subDays(2)]);
        $new = $this->makePost(['slug' => 'baru', 'published_at' => now()->subDay()]);
        $this->makePost(['slug' => 'draf', 'status' => 'draft', 'published_at' => null]);
        $this->makePost(['slug' => 'nanti', 'published_at' => now()->addDay()]);
        $this->makePost(['slug' => 'dihapus'])->delete();

        $response = $this->getJson('/api/v1/posts')->assertOk()
            ->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonPath('total', 2)->assertJsonPath('per_page', 10)
            ->assertJsonPath('data.0.slug', 'baru')->assertJsonPath('data.1.slug', 'lama')
            ->assertJsonPath('data.0.category_label', 'Pemerintahan')->assertJsonPath('data.0.cover_url', null);
        $this->assertSame(['slug', 'title', 'category', 'category_label', 'summary', 'published_at', 'cover_url'], array_keys($response->json('data.0')));
    }

    public function test_public_list_paginates_ten_per_page(): void
    {
        foreach (range(1, 11) as $i) $this->makePost(['slug' => "b-$i", 'published_at' => now()->subMinutes($i)]);
        $this->getJson('/api/v1/posts?page=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.slug', 'b-11');
    }

    public function test_public_detail_returns_body_and_hides_draft_future_and_deleted(): void
    {
        $this->makePost(['slug' => 'terbit', 'body' => '<b>teks</b> apa adanya']);
        $this->makePost(['slug' => 'draf', 'status' => 'draft', 'published_at' => null]);
        $this->makePost(['slug' => 'nanti', 'published_at' => now()->addHour()]);
        $this->makePost(['slug' => 'dihapus'])->delete();

        $this->getJson('/api/v1/posts/terbit')->assertOk()->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonPath('body', '<b>teks</b> apa adanya')->assertJsonMissingPath('id');
        foreach (['draf', 'nanti', 'dihapus', 'tidak-ada'] as $slug) $this->getJson("/api/v1/posts/$slug")->assertNotFound();
    }

    public function test_staff_endpoints_require_token(): void
    {
        $id = $this->makePost()->id;
        $this->getJson('/api/v1/staff/posts')->assertUnauthorized();
        $this->getJson("/api/v1/staff/posts/$id")->assertUnauthorized();
        $this->postJson('/api/v1/staff/posts', $this->payload())->assertUnauthorized();
        $this->patchJson("/api/v1/staff/posts/$id", ['title' => 'X'])->assertUnauthorized();
        $this->deleteJson("/api/v1/staff/posts/$id")->assertUnauthorized();
    }

    public static function forbiddenRoles(): array
    {
        return [['village_head'], ['rt_head'], ['rw_head']];
    }

    #[DataProvider('forbiddenRoles')]
    public function test_other_panel_roles_get_403(string $role): void
    {
        $id = $this->makePost()->id;
        $this->act($role);
        $this->getJson('/api/v1/staff/posts')->assertForbidden()->assertHeader('Cache-Control', 'no-store, private');
        $this->getJson("/api/v1/staff/posts/$id")->assertForbidden();
        $this->postJson('/api/v1/staff/posts', $this->payload())->assertForbidden();
        $this->patchJson("/api/v1/staff/posts/$id", ['title' => 'X'])->assertForbidden();
        $this->deleteJson("/api/v1/staff/posts/$id")->assertForbidden();
        $this->assertSame(1, Post::count());
        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public function test_inactive_staff_or_missing_ability_get_403(): void
    {
        $user = $this->act('staff');
        $user->forceFill(['is_active' => false])->save();
        $this->getJson('/api/v1/staff/posts')->assertForbidden();
        $this->act('admin', ['other']);
        $this->getJson('/api/v1/staff/posts')->assertForbidden();
    }

    public function test_staff_and_admin_can_create_publish_draft_and_delete(): void
    {
        $this->freezeSecond();
        $staff = $this->act('staff');
        $id = $this->postJson('/api/v1/staff/posts', $this->payload())->assertCreated()
            ->assertJsonPath('status', 'draft')->assertJsonPath('published_at', null)->assertJsonPath('slug', 'kerja-bakti-fiktif')->json('id');
        $this->assertSame(['post.created'], $this->auditActions($id));
        $this->getJson('/api/v1/posts/kerja-bakti-fiktif')->assertNotFound();

        $admin = $this->act('admin');
        $published = $this->patchJson("/api/v1/staff/posts/$id", ['status' => 'published'])->assertOk()->json('published_at');
        $this->assertSame(now()->toISOString(), $published);
        $this->getJson('/api/v1/posts/kerja-bakti-fiktif')->assertOk();
        $this->assertSame(['post.created', 'post.updated', 'post.published'], $this->auditActions($id));
        $this->assertSame($admin->id, Post::find($id)->updated_by);
        $this->assertSame($staff->id, Post::find($id)->created_by);

        $this->travel(1)->hours();
        $this->patchJson("/api/v1/staff/posts/$id", ['status' => 'draft'])->assertOk()->assertJsonPath('published_at', $published);
        $this->getJson('/api/v1/posts/kerja-bakti-fiktif')->assertNotFound();
        // Terbit ulang mempertahankan tanggal terbit pertama; post.published tetap dicatat karena status berubah.
        $this->patchJson("/api/v1/staff/posts/$id", ['status' => 'published'])->assertOk()->assertJsonPath('published_at', $published);

        $this->deleteJson("/api/v1/staff/posts/$id")->assertOk();
        $this->assertSoftDeleted('posts', ['id' => $id]);
        $this->getJson('/api/v1/posts/kerja-bakti-fiktif')->assertNotFound();
        $this->getJson("/api/v1/staff/posts/$id")->assertNotFound();
        $this->patchJson("/api/v1/staff/posts/$id", ['title' => 'X'])->assertNotFound();
        $this->getJson('/api/v1/staff/posts')->assertJsonPath('total', 0);
        $this->assertSame(['post.created', 'post.updated', 'post.published', 'post.updated', 'post.updated', 'post.published', 'post.deleted'], $this->auditActions($id));
    }

    public function test_create_as_published_sets_date_and_audits_publish(): void
    {
        $this->act('staff');
        $id = $this->postJson('/api/v1/staff/posts', $this->payload(['status' => 'published']))->assertCreated()->json('id');
        $this->assertNotNull(Post::find($id)->published_at);
        $this->assertSame(['post.created', 'post.published'], $this->auditActions($id));
    }

    public function test_slug_is_unique_and_stable_after_first_publish(): void
    {
        $this->act('staff');
        $this->makePost(['slug' => 'rapat-desa'])->delete(); // slug terhapus tetap dipesan
        $a = $this->postJson('/api/v1/staff/posts', $this->payload(['title' => 'Rapat Desa']))->json();
        $b = $this->postJson('/api/v1/staff/posts', $this->payload(['title' => 'Rapat  desa!']))->json();
        $this->assertSame(['rapat-desa-2', 'rapat-desa-3'], [$a['slug'], $b['slug']]);
        $this->assertSame('berita', $this->postJson('/api/v1/staff/posts', $this->payload(['title' => '!!!']))->json('slug'));

        // Draf yang belum pernah terbit: slug mengikuti judul baru; judul sama tidak menambah akhiran.
        $this->patchJson("/api/v1/staff/posts/{$a['id']}", ['title' => 'Musyawarah Dusun'])->assertJsonPath('slug', 'musyawarah-dusun');
        $this->patchJson("/api/v1/staff/posts/{$a['id']}", ['title' => 'Musyawarah Dusun', 'body' => 'Isi baru.'])->assertJsonPath('slug', 'musyawarah-dusun');

        // Setelah pernah terbit, slug tidak berubah walau judul diedit atau kembali ke draf.
        $this->patchJson("/api/v1/staff/posts/{$a['id']}", ['status' => 'published']);
        $this->patchJson("/api/v1/staff/posts/{$a['id']}", ['title' => 'Judul Lain', 'status' => 'draft'])->assertJsonPath('slug', 'musyawarah-dusun');
        $this->patchJson("/api/v1/staff/posts/{$a['id']}", ['title' => 'Judul Lain Lagi'])->assertJsonPath('slug', 'musyawarah-dusun');
    }

    public function test_validation_rejects_bad_input_with_422(): void
    {
        $this->act('admin');
        $cases = [
            ['title' => ''], ['title' => str_repeat('a', 161)], ['title' => "Judul\x07"],
            ['category' => 'olahraga'], ['summary' => str_repeat('a', 301)], ['summary' => "a\nb"],
            ['body' => str_repeat('a', 20001)], ['body' => "is\x00i"], ['body' => "is\x7Fi"], ['body' => "isi\x1b[31m"], ['status' => 'archived'],
        ];
        foreach ($cases as $case) {
            $field = array_key_first($case);
            $response = $this->postJson('/api/v1/staff/posts', $this->payload($case));
            $this->assertSame(422, $response->status(), json_encode($case));
            $response->assertJsonValidationErrors($field);
        }
        $this->postJson('/api/v1/staff/posts', ['title' => 'Saja'])->assertUnprocessable()->assertJsonValidationErrors(['category', 'summary', 'body', 'status']);
        $id = $this->makePost()->id;
        $this->patchJson("/api/v1/staff/posts/$id", ['category' => 'olahraga'])->assertUnprocessable();
        $this->getJson('/api/v1/staff/posts?status=deleted')->assertUnprocessable();
        $this->assertSame(1, Post::count());
    }

    public function test_input_is_trimmed_and_html_stored_verbatim(): void
    {
        $this->act('staff');
        $body = str_repeat('a', 19978)."\r\n\n\t<script>x</script>"; // tepat 20.000 karakter
        $this->assertSame(20000, mb_strlen($body));
        $response = $this->postJson('/api/v1/staff/posts', $this->payload(['title' => '  Judul  ', 'summary' => ' Ringkas ', 'body' => "  $body  "]))->assertCreated();
        $response->assertJsonPath('title', 'Judul')->assertJsonPath('summary', 'Ringkas')->assertJsonPath('body', $body);
    }

    public function test_staff_list_filters_searches_and_excludes_deleted(): void
    {
        $this->act('staff');
        $this->makePost(['slug' => 'a', 'title' => 'Posyandu Balita']);
        $this->makePost(['slug' => 'b', 'title' => 'Posyandu Lansia', 'status' => 'draft', 'published_at' => null]);
        $this->makePost(['slug' => 'c', 'title' => '100% Posyandu']);
        $this->makePost(['slug' => 'd', 'title' => 'Posyandu Lama'])->delete();

        $this->getJson('/api/v1/staff/posts')->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('total', 3)->assertJsonMissingPath('data.0.body');
        $this->getJson('/api/v1/staff/posts?status=draft')->assertJsonPath('total', 1)->assertJsonPath('data.0.slug', 'b');
        $this->getJson('/api/v1/staff/posts?q=LANSIA')->assertJsonPath('total', 1);
        $this->getJson('/api/v1/staff/posts?q=%25')->assertJsonPath('total', 1)->assertJsonPath('data.0.slug', 'c');
        $this->getJson('/api/v1/staff/posts?status=published&q=posyandu')->assertJsonPath('total', 2);
    }

    public function test_audit_never_contains_post_content(): void
    {
        $this->act('staff');
        $id = $this->postJson('/api/v1/staff/posts', $this->payload(['title' => 'Judul Rahasia Unik', 'status' => 'published']))->json('id');
        $this->patchJson("/api/v1/staff/posts/$id", ['body' => 'Isi Rahasia Unik']);
        $this->deleteJson("/api/v1/staff/posts/$id");
        $dump = json_encode(DB::table('audit_logs')->get());
        $this->assertStringNotContainsString('Rahasia', $dump);
        $this->assertSame(['id', 'user_id', 'action', 'subject_type', 'subject_id', 'created_at'], array_keys((array) DB::table('audit_logs')->first()));
    }
}
