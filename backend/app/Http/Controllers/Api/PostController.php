<?php
namespace App\Http\Controllers\Api;

use App\Domain\PostCategory;
use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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

    public function uploadCover(Request $request, int $id): JsonResponse {
        if (! $request->user()->canManageContent()) return $this->forbidden();
        Post::findOrFail($id);
        $request->validate(['file'=>[
            'bail', 'required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:3072',
            'dimensions:min_width=600,min_height=400,max_width=6000,max_height=6000',
        ]]);
        abort_unless(extension_loaded('gd'), 503, 'Pengolah foto belum tersedia. Hubungi administrator.');
        $bytes = file_get_contents($request->file('file')->getRealPath());
        abort_if($bytes === false, 500, 'Foto gagal dibaca.');
        $source = @imagecreatefromstring($bytes);
        if ($source === false) throw ValidationException::withMessages(['file'=>'Foto tidak dapat dibaca. Pilih JPG, PNG, atau WebP yang valid.']);
        $webp = function_exists('imagewebp') && (imagetypes() & IMG_WEBP) !== 0;
        $width = min(1600, imagesx($source));
        $height = max(1, (int) round(imagesy($source) * $width / imagesx($source)));
        $image = imagecreatetruecolor($width, $height);
        $stream = tmpfile();
        try {
            abort_if($image === false || $stream === false, 500, 'Foto gagal diproses.');
            // Kanvas baru hanya berisi piksel: EXIF/GPS dan metadata lain tidak disalin.
            if ($webp) {
                imagealphablending($image, false);
                imagesavealpha($image, true);
                imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
            } else {
                imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
            }
            abort_unless(imagecopyresampled($image, $source, 0, 0, 0, 0, $width, $height, imagesx($source), imagesy($source)), 500, 'Foto gagal diperkecil.');
            $encoded = $webp ? imagewebp($image, $stream, 80) : imagejpeg($image, $stream, 82);
            abort_unless($encoded && ftell($stream) > 0, 500, 'Foto gagal disimpan.');
            rewind($stream);
            $path = 'posts/'.Str::uuid().($webp ? '.webp' : '.jpg');
            try {
                abort_unless(Storage::disk('public')->put($path, $stream), 500, 'Foto gagal disimpan.');
                $post = $this->changeCover($request, $id, $path, $oldPath);
            } catch (\Throwable $e) {
                Storage::disk('public')->delete($path);
                throw $e;
            }
        } finally {
            imagedestroy($source);
            if ($image !== false) imagedestroy($image);
            if (is_resource($stream)) fclose($stream);
        }
        // Hapus hanya setelah commit; kegagalan DB tidak merusak sampul sebelumnya.
        $this->removeCoverFile($oldPath);
        return response()->json($this->staffDetail($post))->header('Cache-Control', 'private, no-store');
    }

    public function deleteCover(Request $request, int $id): JsonResponse {
        if (! $request->user()->canManageContent()) return $this->forbidden();
        $post = $this->changeCover($request, $id, null, $oldPath);
        $this->removeCoverFile($oldPath);
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
