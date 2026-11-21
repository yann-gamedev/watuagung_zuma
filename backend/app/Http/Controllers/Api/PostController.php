<?php
namespace App\Http\Controllers\Api;

use App\Domain\PostCategory;
use App\Domain\SocialPlatform;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\PostImage;
use App\Support\ImageProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
            'cover_url'=>$post->cover_path ? Storage::disk('public')->url($post->cover_path) : null,
        ];
    }

    private function staffItem(Post $post): array {
        return ['id'=>$post->id, 'status'=>$post->status] + $this->item($post) + ['updated_at'=>$post->updated_at->toISOString()];
    }

    private function staffDetail(Post $post): array {
        $post->load('images');
        return $this->staffItem($post) + [
            'body'=>$post->body,
            'show_copyright'=>$post->show_copyright,
            ...collect(SocialPlatform::cases())->mapWithKeys(fn (SocialPlatform $p) => [$p->column() => $post->{$p->column()}])->all(),
            'images'=>$post->images->map(fn (PostImage $image) => [
                'id'=>$image->id, 'url'=>$this->imageUrl($image), 'caption'=>$image->caption,
            ])->values(),
            'created_at'=>$post->created_at->toISOString(),
        ];
    }

    private function imageUrl(PostImage $image): string {
        return Storage::disk('public')->url($image->path);
    }

    public function index(): JsonResponse {
        $page = Post::published()->select(['id','slug','title','category','summary','published_at','cover_path'])
            ->orderByDesc('published_at')->orderByDesc('id')->paginate(10)->through(fn (Post $post) => $this->item($post));
        return response()->json($page)->header('Cache-Control', self::PUBLIC_CACHE);
    }

    public function show(string $slug): JsonResponse {
        $post = Post::published()->with('images')->where('slug', $slug)->firstOrFail();
        return response()->json($this->item($post) + [
            'body'=>$post->body,
            'show_copyright'=>$post->show_copyright,
            // Hanya yang terisi; objek kosong bila tidak ada tautan.
            'social_links'=>(object) $post->socialLinks(),
            'images'=>$post->images->map(fn (PostImage $image) => [
                'url'=>$this->imageUrl($image), 'caption'=>$image->caption,
            ])->values(),
        ])->header('Cache-Control', self::PUBLIC_CACHE);
    }

    public function staffIndex(Request $request): JsonResponse {
        if (! $request->user()->canManageMedia()) return $this->forbidden();
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
        if (! $request->user()->canManageMedia()) return $this->forbidden();
        return response()->json($this->staffDetail(Post::findOrFail($id)))->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request): JsonResponse {
        $user = $request->user();
        if (! $user->canManageMedia()) return $this->forbidden();
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
        if (! $user->canManageMedia()) return $this->forbidden();
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
        if (! $user->canManageMedia()) return $this->forbidden();
        $oldPath = null;
        $imagePaths = [];
        DB::transaction(function () use ($user, $id, &$oldPath, &$imagePaths) {
            $post = Post::lockForUpdate()->findOrFail($id);
            $oldPath = $post->cover_path;
            $imagePaths = $post->images()->pluck('path')->all();
            $post->images()->delete();
            $post->forceFill(['updated_by'=>$user->id, 'cover_path'=>null])->save();
            $post->delete();
            $this->audit($user->id, 'post.deleted', $post);
        });
        // Sampul dan foto tambahan ikut dihapus setelah commit agar storage tidak penuh.
        // Gagal hapus tidak membatalkan penghapusan; file yatim dibersihkan `media:prune`.
        foreach ([$oldPath, ...$imagePaths] as $path) {
            if ($path !== null && ! Storage::disk('public')->delete($path)) Log::warning('Foto berita terhapus gagal dihapus.', ['path'=>$path]);
        }
        return response()->json(['success'=>true])->header('Cache-Control', 'private, no-store');
    }

    public function uploadCover(Request $request, int $id): JsonResponse {
        if (! $request->user()->canManageMedia()) return $this->forbidden();
        Post::findOrFail($id);
        $request->validate(['file'=>['bail', 'required', 'file']], [
            'file.required'=>'Pilih foto yang akan diunggah.',
            'file.file'=>'Foto harus berupa file yang valid.',
            'file.uploaded'=>ImageProcessor::UPLOAD_FAILED,
        ]);
        $path = ImageProcessor::store($request->file('file'), 'posts', 10240, 2000, minWidth: 1, minHeight: 1, maxHeight: 2000);
        try {
            $post = $this->changeCover($request, $id, $path, $oldPath);
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }
        // Hapus hanya setelah commit; kegagalan DB tidak merusak sampul sebelumnya.
        $this->removeCoverFile($oldPath);
        return response()->json($this->staffDetail($post))->header('Cache-Control', 'private, no-store');
    }

    public function deleteCover(Request $request, int $id): JsonResponse {
        if (! $request->user()->canManageMedia()) return $this->forbidden();
        $post = $this->changeCover($request, $id, null, $oldPath);
        $this->removeCoverFile($oldPath);
        return response()->json($this->staffDetail($post))->header('Cache-Control', 'private, no-store');
    }

    /** Maksimal 3 foto tambahan; foto pertama tampil setelah paragraf pertama, dan seterusnya. */
    public function uploadImage(Request $request, int $id): JsonResponse {
        $user = $request->user();
        if (! $user->canManageMedia()) return $this->forbidden();
        Post::findOrFail($id);
        $data = $request->validate([
            'file'=>['bail', 'required', 'file'],
            'caption'=>['sometimes', 'nullable', 'string', 'max:200', self::NO_CONTROL],
        ], [
            'file.required'=>'Pilih foto yang akan diunggah.',
            'file.file'=>'Foto harus berupa file yang valid.',
            'file.uploaded'=>ImageProcessor::UPLOAD_FAILED,
        ]);
        $path = ImageProcessor::store($request->file('file'), 'posts', 10240, 2000, minWidth: 1, minHeight: 1, maxHeight: 2000);
        try {
            $post = DB::transaction(function () use ($data, $user, $id, $path) {
                $post = Post::lockForUpdate()->findOrFail($id);
                $count = PostImage::where('post_id', $post->id)->count();
                if ($count >= 3) throw ValidationException::withMessages(['file'=>'Maksimal 3 foto tambahan per berita.']);
                PostImage::create([
                    'post_id'=>$post->id, 'path'=>$path,
                    'caption'=>trim((string) ($data['caption'] ?? '')) ?: null,
                    'position'=>(int) PostImage::where('post_id', $post->id)->max('position') + 1,
                ]);
                $post->forceFill(['updated_by'=>$user->id])->save();
                $this->audit($user->id, 'post.updated', $post);
                return $post;
            });
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }
        return response()->json($this->staffDetail($post))->header('Cache-Control', 'private, no-store');
    }

    public function updateImage(Request $request, int $id, int $image): JsonResponse {
        $user = $request->user();
        if (! $user->canManageMedia()) return $this->forbidden();
        $data = $request->validate([
            'caption'=>['sometimes', 'nullable', 'string', 'max:200', self::NO_CONTROL],
        ]);
        $post = DB::transaction(function () use ($data, $user, $id, $image) {
            $post = Post::lockForUpdate()->findOrFail($id);
            $row = PostImage::where('post_id', $post->id)->lockForUpdate()->findOrFail($image);
            $row->forceFill(['caption'=>trim((string) ($data['caption'] ?? '')) ?: null])->save();
            $post->forceFill(['updated_by'=>$user->id])->save();
            $this->audit($user->id, 'post.updated', $post);
            return $post;
        });
        return response()->json($this->staffDetail($post))->header('Cache-Control', 'private, no-store');
    }

    public function deleteImage(Request $request, int $id, int $image): JsonResponse {
        $user = $request->user();
        if (! $user->canManageMedia()) return $this->forbidden();
        $path = null;
        $post = DB::transaction(function () use ($user, $id, $image, &$path) {
            $post = Post::lockForUpdate()->findOrFail($id);
            $row = PostImage::where('post_id', $post->id)->lockForUpdate()->findOrFail($image);
            $path = $row->path;
            $row->delete();
            $post->forceFill(['updated_by'=>$user->id])->save();
            $this->audit($user->id, 'post.updated', $post);
            return $post;
        });
        // File dihapus setelah commit; kegagalan hanya menyisakan file yatim yang dibersihkan `media:prune`.
        if ($path !== null && ! Storage::disk('public')->delete($path)) Log::warning('Foto tambahan berita gagal dihapus.', ['path'=>$path]);
        return response()->json($this->staffDetail($post))->header('Cache-Control', 'private, no-store');
    }

    private function changeCover(Request $request, int $id, ?string $path, ?string &$oldPath): Post {
        return DB::transaction(function () use ($request, $id, $path, &$oldPath) {
            $post = Post::lockForUpdate()->findOrFail($id);
            $oldPath = $post->cover_path;
            $post->forceFill(['cover_path'=>$path, 'updated_by'=>$request->user()->id])->save();
            $this->audit($request->user()->id, 'post.updated', $post);
            return $post;
        });
    }

    private function removeCoverFile(?string $path): void {
        if ($path !== null) abort_unless(Storage::disk('public')->delete($path), 500, 'Sampul diperbarui, tetapi file lama gagal dihapus. Hubungi administrator.');
    }

    private function rules(bool $creating): array {
        $required = $creating ? 'required' : 'sometimes';
        return [
            'title'=>[$required, 'string', 'max:160', self::NO_CONTROL],
            'category'=>[$required, Rule::enum(PostCategory::class)],
            'summary'=>[$required, 'string', 'max:300', self::NO_CONTROL],
            'body'=>[$required, 'string', 'max:20000', self::BODY_NO_CONTROL],
            'status'=>[$required, Rule::in(['draft', 'published'])],
            'show_copyright'=>['sometimes', 'boolean'],
        ] + collect(SocialPlatform::cases())->mapWithKeys(fn (SocialPlatform $platform) => [$platform->column() => [
            'sometimes', 'nullable', 'string', 'max:500', self::NO_CONTROL,
            function (string $attribute, mixed $value, \Closure $fail) use ($platform) {
                if (is_string($value) && ! $platform->accepts($value)) {
                    $fail("Tautan {$platform->label()} harus diawali https:// dan mengarah ke ".$platform->hosts()[0].'.');
                }
            },
        ]])->all();
    }

    /** Hanya aksi dan ID; judul/isi berita tidak masuk audit. */
    private function audit(int $userId, string $action, Post $post): void {
        DB::table('audit_logs')->insert(['user_id'=>$userId, 'action'=>$action, 'subject_type'=>'post', 'subject_id'=>$post->id, 'created_at'=>now()]);
    }

    private function forbidden(): JsonResponse {
        return response()->json(['message'=>'Akses ditolak.'], 403)->header('Cache-Control', 'private, no-store');
    }
}
