<?php

namespace App\Http\Controllers\Api;

use App\Domain\SiteSection as SectionKey;
use App\Domain\SiteSectionRules;
use App\Http\Controllers\Controller;
use App\Models\SiteSection;
use App\Support\ImageProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SiteSectionController extends Controller
{
    public function show(string $key): JsonResponse
    {
        $section = $this->key($key);
        $row = SiteSection::findOrFail($section->value);
        return response()->json($this->item($row))->header('Cache-Control', 'public, max-age=60');
    }

    public function staffShow(Request $request, string $key): JsonResponse
    {
        abort_unless($request->user()->canManageContent(), 403, 'Akses ditolak.');
        $section = $this->key($key);
        return response()->json($this->item(SiteSection::findOrFail($section->value)))->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request, string $key): JsonResponse
    {
        abort_unless($request->user()->canManageContent(), 403, 'Akses ditolak.');
        $section = $this->key($key);
        if (! $section->allowsDocuments()) return $this->save($request, $section);

        // ponytail: satu host/VPS; multi-host perlu lock bersama sebelum berbagi disk dokumen.
        // Lock meliputi validasi keberadaan PDF, commit, dan penghapusan agar PUT lain tak merujuk file yang sedang dihapus.
        $lock = fopen(storage_path('framework/cache/site-transparency.lock'), 'c');
        abort_if($lock === false, 503, 'Penyimpanan sementara tidak tersedia.');
        try {
            abort_unless(flock($lock, LOCK_EX), 503, 'Penyimpanan sementara tidak tersedia.');
            return $this->save($request, $section);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function save(Request $request, SectionKey $section): JsonResponse
    {
        $data = SiteSectionRules::validate($section, $request->all());
        $before = $this->documents(SiteSection::find($section->value)?->data);
        $row = DB::transaction(function () use ($request, $section, $data) {
            // Native upsert handles concurrent first writes; one entire object wins, never a merge.
            SiteSection::upsert([
                'key' => $section->value, 'data' => json_encode($data, JSON_THROW_ON_ERROR),
                'updated_by' => $request->user()->id,
            ], ['key'], ['data', 'updated_by', 'updated_at']);
            DB::table('audit_logs')->insert([
                'user_id' => $request->user()->id, 'action' => 'site.updated',
                'subject_type' => 'site_section', 'subject_id' => $section->value, 'created_at' => now(),
            ]);
            return SiteSection::findOrFail($section->value);
        });
        // Setelah commit: file yang tak lagi dirujuk dihapus; kalau commit gagal, file lama tetap ada.
        Storage::disk('public')->delete(array_values(array_diff($before, $this->documents($data))));
        return response()->json($this->item($row))->header('Cache-Control', 'private, no-store');
    }

    public function document(Request $request, string $key): JsonResponse
    {
        abort_unless($request->user()->canManageContent(), 403, 'Akses ditolak.');
        $section = $this->key($key);
        if (! $section->allowsDocuments()) throw ValidationException::withMessages(['file' => 'Bagian ini tidak mengizinkan dokumen.']);
        $request->validate(['file' => ['bail', 'required', 'file', 'max:10240', function (string $attribute, $file, \Closure $fail) {
            if (! str_starts_with((string) file_get_contents($file->getRealPath(), false, null, 0, 5), '%PDF-')) $fail('Berkas harus PDF.');
        }]]);
        // ponytail: unggahan yang tidak pernah disimpan lewat PUT tetap di disk; tambah pembersihan berkala bila menumpuk.
        $path = Storage::disk('public')->putFileAs('site/documents', $request->file('file'), Str::uuid().'.pdf');
        abort_if($path === false, 500, 'Dokumen gagal disimpan.');
        return response()->json(['path' => $path, 'url' => Storage::disk('public')->url($path)])->header('Cache-Control', 'private, no-store');
    }

    private function documents(?array $data): array
    {
        return array_values(array_filter(array_column($data['budgets'] ?? [], 'documentPath'), 'is_string'));
    }

    public function image(Request $request, string $key): JsonResponse
    {
        abort_unless($request->user()->canManageContent(), 403, 'Akses ditolak.');
        $section = $this->key($key);
        if (! $section->allowsImages()) throw ValidationException::withMessages(['file' => 'Bagian ini tidak mengizinkan gambar.']);
        $request->validate(['file' => ['required', 'file']]);
        $path = ImageProcessor::store($request->file('file'), 'site/'.$section->value, 3072, 1600);
        return response()->json(['path' => $path])->header('Cache-Control', 'private, no-store');
    }

    private function key(string $key): SectionKey
    {
        return SectionKey::tryFrom($key) ?? abort(404);
    }

    private function item(SiteSection $row): array
    {
        $item = ['key' => $row->key, 'data' => $row->data, 'updated_at' => $row->updated_at->toISOString()];
        if ($row->key === SectionKey::Transparency->value) {
            $paths = $this->documents($row->data);
            $item['document_urls'] = (object) array_combine($paths, array_map(fn ($path) => Storage::disk('public')->url($path), $paths));
        }
        return $item;
    }
}
