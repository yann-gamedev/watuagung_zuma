<?php
namespace App\Http\Controllers\Api;

use App\Domain\PostCategory;
use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Berita: baca publik + kelola admin/staff. Isi disimpan sebagai teks biasa, tidak pernah diproses sebagai HTML. */
class PostController extends Controller {
    /** Karakter kontrol ditolak; isi boleh memuat baris baru dan tab. */
    private const NO_CONTROL = 'not_regex:/\p{Cc}/u';
    private const BODY_NO_CONTROL = 'not_regex:/(?![\n\r\t])\p{Cc}/u';
    private const PUBLIC_CACHE = 'public, max-age=60';

    private function item(Post $post): array {
        return [
            'slug'=>$post->slug, 'title'=>$post->title,
            'category'=>$post->category->value, 'category_label'=>$post->category->label(),
            'summary'=>$post->summary, 'published_at'=>$post->published_at?->toISOString(),
            'cover_url'=>null, // diisi di sesi C2 (foto sampul)
        ];
    }

    private function staffItem(Post $post): array {
        return ['id'=>$post->id, 'status'=>$post->status] + $this->item($post) + ['updated_at'=>$post->updated_at->toISOString()];
    }

    private function staffDetail(Post $post): array {
        return $this->staffItem($post) + ['body'=>$post->body, 'created_at'=>$post->created_at->toISOString()];
    }

    public function index(): JsonResponse {
        $page = Post::published()->select(['id','slug','title','category','summary','published_at','cover_path'])
            ->orderByDesc('published_at')->orderByDesc('id')->paginate(10)->through(fn (Post $post) => $this->item($post));
        return response()->json($page)->header('Cache-Control', self::PUBLIC_CACHE);
    }

    public function show(string $slug): JsonResponse {
        $post = Post::published()->where('slug', $slug)->firstOrFail();
        return response()->json($this->item($post) + ['body'=>$post->body])->header('Cache-Control', self::PUBLIC_CACHE);
    }

    public function staffIndex(Request $request): JsonResponse {
        if (! $request->user()->canManageContent()) return $this->forbidden();
        $data = $request->validate([
            'status'=>['sometimes', Rule::in(['draft', 'published'])],
            'q'=>['sometimes', 'nullable', 'string', 'max:100'],
            'page'=>['sometimes', 'integer', 'min:1'],
        ]);
        $query = Post::query()->select(['id','slug','title','category','summary','status','published_at','cover_path','updated_at']);
        if (isset($data['status'])) $query->where('status', $data['status']);
        if (filled($data['q'] ?? null)) {
            // Pencarian judul literal, sama seperti daftar permohonan.
            $search = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($data['q'])).'%';
            $query->whereRaw("LOWER(title) LIKE ? ESCAPE '!'", [$search]);
        }
        $page = $query->orderByDesc('updated_at')->orderByDesc('id')->paginate(20)->through(fn (Post $post) => $this->staffItem($post));
        return response()->json($page)->header('Cache-Control', 'private, no-store');
    }

    public function staffShow(Request $request, int $id): JsonResponse {
        if (! $request->user()->canManageContent()) return $this->forbidden();
        return response()->json($this->staffDetail(Post::findOrFail($id)))->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request): JsonResponse {
        $user = $request->user();
        if (! $user->canManageContent()) return $this->forbidden();
        $data = $request->validate($this->rules(true));
        $post = DB::transaction(function () use ($data, $user) {
            $post = new Post($data + ['created_by'=>$user->id, 'updated_by'=>$user->id]);
            $post->slug = Post::uniqueSlug($data['title']);
            if ($post->status === 'published') $post->published_at = now();
            $post->save();
            $this->audit($user->id, 'post.created', $post);
            if ($post->status === 'published') $this->audit($user->id, 'post.published', $post);
            return $post;
        });
        return response()->json($this->staffDetail($post), 201)->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request, int $id): JsonResponse {
        $user = $request->user();
        if (! $user->canManageContent()) return $this->forbidden();
        $data = $request->validate($this->rules(false));
        $post = DB::transaction(function () use ($data, $user, $id) {
            $post = Post::lockForUpdate()->findOrFail($id);
            $wasPublished = $post->status === 'published';
            $post->fill($data + ['updated_by'=>$user->id]);
            // Slug mengikuti judul hanya sebelum pernah terbit; setelahnya tetap agar tautan lama hidup.
            if ($post->isDirty('title') && $post->published_at === null) $post->slug = Post::uniqueSlug($post->title, $post->id);
            // Terbit pertama mengisi published_at; kembali ke draf mempertahankannya.
            if ($post->status === 'published' && $post->published_at === null) $post->published_at = now();
            $post->save();
            $this->audit($user->id, 'post.updated', $post);
            if (! $wasPublished && $post->status === 'published') $this->audit($user->id, 'post.published', $post);
            return $post;
        });
        return response()->json($this->staffDetail($post))->header('Cache-Control', 'private, no-store');
    }

    public function destroy(Request $request, int $id): JsonResponse {
        $user = $request->user();
        if (! $user->canManageContent()) return $this->forbidden();
        DB::transaction(function () use ($user, $id) {
            $post = Post::lockForUpdate()->findOrFail($id);
            $post->forceFill(['updated_by'=>$user->id])->save();
            $post->delete();
            $this->audit($user->id, 'post.deleted', $post);
        });
        return response()->json(['success'=>true])->header('Cache-Control', 'private, no-store');
    }

    private function rules(bool $creating): array {
        $required = $creating ? 'required' : 'sometimes';
        return [
            'title'=>[$required, 'string', 'max:160', self::NO_CONTROL],
            'category'=>[$required, Rule::enum(PostCategory::class)],
            'summary'=>[$required, 'string', 'max:300', self::NO_CONTROL],
            'body'=>[$required, 'string', 'max:20000', self::BODY_NO_CONTROL],
            'status'=>[$required, Rule::in(['draft', 'published'])],
        ];
    }

    /** Hanya aksi dan ID; judul/isi berita tidak masuk audit. */
    private function audit(int $userId, string $action, Post $post): void {
        DB::table('audit_logs')->insert(['user_id'=>$userId, 'action'=>$action, 'subject_type'=>'post', 'subject_id'=>$post->id, 'created_at'=>now()]);
    }

    private function forbidden(): JsonResponse {
        return response()->json(['message'=>'Akses ditolak.'], 403)->header('Cache-Control', 'private, no-store');
    }
}
