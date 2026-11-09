<?php
namespace App\Http\Controllers\Api;

use App\Domain\BusinessCategory;
use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Support\ImageProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Direktori UMKM warga: baca publik + kelola admin/staff, pola sama dengan PostController.
 * Nama pemilik dan WhatsApp hanya keluar ke publik bila consent_public_contact true; tidak pernah di daftar petugas.
 */
class BusinessController extends Controller {
    private const NO_CONTROL = 'not_regex:/\p{Cc}/u';
    private const TEXT_NO_CONTROL = 'not_regex:/(?![\n\r])\p{Cc}/u';
    private const PUBLIC_CACHE = 'public, max-age=60';
    private const PRIVATE_CACHE = 'private, no-store';

    private function item(Business $business): array {
        return [
            'slug'=>$business->slug, 'name'=>$business->name,
            'category'=>$business->category->value, 'category_label'=>$business->category->label(),
            'description'=>$business->description, 'hamlet'=>$business->hamlet,
            'photo_url'=>$business->photo_path ? Storage::disk('public')->url($business->photo_path) : null,
            'published_at'=>$business->published_at?->toISOString(),
        ];
    }

    /** Key kontak tidak ada sama sekali tanpa izin pemilik, bukan null. */
    private function publicItem(Business $business): array {
        $item = $this->item($business);
        if ($business->consent_public_contact) $item += ['owner_name'=>$business->owner_name, 'whatsapp'=>$business->whatsapp];
        return $item;
    }

    private function staffItem(Business $business): array {
        $item = $this->item($business);
        unset($item['description']);
        return ['id'=>$business->id, 'status'=>$business->status] + $item
            + ['consent_public_contact'=>$business->consent_public_contact, 'updated_at'=>$business->updated_at->toISOString()];
    }

    private function staffDetail(Business $business): array {
        return $this->staffItem($business) + [
            'description'=>$business->description, 'owner_name'=>$business->owner_name, 'whatsapp'=>$business->whatsapp,
            'created_at'=>$business->created_at->toISOString(),
        ];
    }

    public function index(Request $request): JsonResponse {
        $data = $request->validate([
            'category'=>['sometimes', Rule::enum(BusinessCategory::class)],
            'sort'=>['sometimes', Rule::in(['name', 'latest'])],
            'page'=>['sometimes', 'integer', 'min:1'],
        ]);
        $query = Business::published();
        if (isset($data['category'])) $query->where('category', $data['category']);
        // Bawaan urut nama (direktori); `latest` untuk kartu beranda (terbit terbaru).
        if (($data['sort'] ?? 'name') === 'latest') $query->orderByDesc('published_at')->orderByDesc('id');
        else $query->orderBy('name')->orderBy('id');
        $page = $query->paginate(12)->through(fn (Business $business) => $this->publicItem($business));
        return response()->json($page)->header('Cache-Control', self::PUBLIC_CACHE);
    }

    public function show(string $slug): JsonResponse {
        $business = Business::published()->where('slug', $slug)->firstOrFail();
        return response()->json($this->publicItem($business))->header('Cache-Control', self::PUBLIC_CACHE);
    }

    public function staffIndex(Request $request): JsonResponse {
        if (! $request->user()->canManageMedia()) return $this->forbidden();
        $data = $request->validate([
            'status'=>['sometimes', Rule::in(['draft', 'published'])],
            'category'=>['sometimes', Rule::enum(BusinessCategory::class)],
            'q'=>['sometimes', 'nullable', 'string', 'max:100'],
            'page'=>['sometimes', 'integer', 'min:1'],
        ]);
        // Kolom kontak tidak dipilih: daftar tidak pernah memuat nama pemilik/WhatsApp.
        $query = Business::query()->select(['id', 'slug', 'name', 'category', 'description', 'hamlet', 'consent_public_contact', 'photo_path', 'status', 'published_at', 'updated_at']);
        if (isset($data['status'])) $query->where('status', $data['status']);
        if (isset($data['category'])) $query->where('category', $data['category']);
        if (filled($data['q'] ?? null)) {
            $search = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($data['q'])).'%';
            $query->whereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$search]);
        }
        $page = $query->orderByDesc('updated_at')->orderByDesc('id')->paginate(20)->through(fn (Business $business) => $this->staffItem($business));
        return response()->json($page)->header('Cache-Control', self::PRIVATE_CACHE);
    }

    public function staffShow(Request $request, int $id): JsonResponse {
        if (! $request->user()->canManageMedia()) return $this->forbidden();
        return response()->json($this->staffDetail(Business::findOrFail($id)))->header('Cache-Control', self::PRIVATE_CACHE);
    }

    public function store(Request $request): JsonResponse {
        $user = $request->user();
        if (! $user->canManageMedia()) return $this->forbidden();
        $data = $request->validate($this->rules(true));
        $business = DB::transaction(function () use ($data, $user) {
            $business = new Business($data + ['created_by'=>$user->id, 'updated_by'=>$user->id]);
            $business->slug = Business::uniqueSlug($data['name']);
            if ($business->status === 'published') $business->published_at = now();
            $business->save();
            $this->audit($user->id, 'business.created', $business);
            if ($business->status === 'published') $this->audit($user->id, 'business.published', $business);
            return $business;
        });
        return response()->json($this->staffDetail($business->refresh()), 201)->header('Cache-Control', self::PRIVATE_CACHE);
    }

    public function update(Request $request, int $id): JsonResponse {
        $user = $request->user();
        if (! $user->canManageMedia()) return $this->forbidden();
        $data = $request->validate($this->rules(false));
        $business = DB::transaction(function () use ($data, $user, $id) {
            $business = Business::lockForUpdate()->findOrFail($id);
            $wasPublished = $business->status === 'published';
            $business->fill($data + ['updated_by'=>$user->id]);
            // Slug mengikuti nama hanya sebelum pernah terbit; setelahnya tetap agar tautan lama hidup.
            if ($business->isDirty('name') && $business->published_at === null) $business->slug = Business::uniqueSlug($business->name, $business->id);
            if ($business->status === 'published' && $business->published_at === null) $business->published_at = now();
            $business->save();
            $this->audit($user->id, 'business.updated', $business);
            if (! $wasPublished && $business->status === 'published') $this->audit($user->id, 'business.published', $business);
            return $business;
        });
        return response()->json($this->staffDetail($business))->header('Cache-Control', self::PRIVATE_CACHE);
    }

    public function destroy(Request $request, int $id): JsonResponse {
        $user = $request->user();
        if (! $user->canManageMedia()) return $this->forbidden();
        DB::transaction(function () use ($user, $id) {
            $business = Business::lockForUpdate()->findOrFail($id);
            $business->forceFill(['updated_by'=>$user->id])->save();
            $business->delete();
            $this->audit($user->id, 'business.deleted', $business);
        });
        return response()->json(['success'=>true])->header('Cache-Control', self::PRIVATE_CACHE);
    }

    public function uploadPhoto(Request $request, int $id): JsonResponse {
        if (! $request->user()->canManageMedia()) return $this->forbidden();
        Business::findOrFail($id);
        $request->validate(['file'=>['bail', 'required', 'file']]);
        $path = ImageProcessor::store($request->file('file'), 'businesses', 3072, 1600);
        try {
            $business = $this->changePhoto($request, $id, $path, $oldPath);
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }
        // Hapus hanya setelah commit; kegagalan DB tidak merusak foto sebelumnya.
        $this->removePhotoFile($oldPath);
        return response()->json($this->staffDetail($business))->header('Cache-Control', self::PRIVATE_CACHE);
    }

    public function deletePhoto(Request $request, int $id): JsonResponse {
        if (! $request->user()->canManageMedia()) return $this->forbidden();
        $business = $this->changePhoto($request, $id, null, $oldPath);
        $this->removePhotoFile($oldPath);
        return response()->json($this->staffDetail($business))->header('Cache-Control', self::PRIVATE_CACHE);
    }

    private function changePhoto(Request $request, int $id, ?string $path, ?string &$oldPath): Business {
        return DB::transaction(function () use ($request, $id, $path, &$oldPath) {
            $business = Business::lockForUpdate()->findOrFail($id);
            $oldPath = $business->photo_path;
            $business->forceFill(['photo_path'=>$path, 'updated_by'=>$request->user()->id])->save();
            $this->audit($request->user()->id, 'business.updated', $business);
            return $business;
        });
    }

    private function removePhotoFile(?string $path): void {
        if ($path !== null) abort_unless(Storage::disk('public')->delete($path), 500, 'Foto diperbarui, tetapi file lama gagal dihapus. Hubungi administrator.');
    }

    private function rules(bool $creating): array {
        $required = $creating ? 'required' : 'sometimes';
        return [
            'name'=>[$required, 'string', 'max:120', self::NO_CONTROL],
            'category'=>[$required, Rule::enum(BusinessCategory::class)],
            'description'=>[$required, 'string', 'max:3000', self::TEXT_NO_CONTROL],
            'hamlet'=>['sometimes', 'nullable', Rule::in(Business::HAMLETS)],
            'owner_name'=>['sometimes', 'nullable', 'string', 'max:120', self::NO_CONTROL],
            'whatsapp'=>['sometimes', 'nullable', 'string', 'regex:/\A62[0-9]{8,13}\z/'],
            'consent_public_contact'=>['sometimes', 'boolean'],
            'status'=>[$required, Rule::in(['draft', 'published'])],
        ];
    }

    /** Hanya aksi dan ID; nama usaha/pemilik/nomor tidak masuk audit. */
    private function audit(int $userId, string $action, Business $business): void {
        DB::table('audit_logs')->insert(['user_id'=>$userId, 'action'=>$action, 'subject_type'=>'business', 'subject_id'=>$business->id, 'created_at'=>now()]);
    }

    private function forbidden(): JsonResponse {
        return response()->json(['message'=>'Akses ditolak.'], 403)->header('Cache-Control', self::PRIVATE_CACHE);
    }
}
