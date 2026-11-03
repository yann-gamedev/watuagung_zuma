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
        $data = SiteSectionRules::validate($section, $request->all());
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
        return response()->json($this->item($row))->header('Cache-Control', 'private, no-store');
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
        return ['key' => $row->key, 'data' => $row->data, 'updated_at' => $row->updated_at->toISOString()];
    }
}
