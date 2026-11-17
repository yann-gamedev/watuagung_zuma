<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Support\AttachmentStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

/** Lampiran persyaratan untuk petugas kantor dan Kepala Desa. Setiap pembukaan diaudit. */
class AttachmentController extends Controller
{
    /** Ketua RT/RW dan KIM tidak membuka dokumen identitas. */
    private const READERS = ['staff', 'admin', 'village_head'];

    public function show(Request $request, string $request_id, string $id): Response
    {
        $user = $request->user();
        if (! $user->canManageApplications() || ! in_array($user->role, self::READERS, true)) {
            return response()->json(['message' => 'Akses ditolak.'], 403)->header('Cache-Control', 'private, no-store');
        }
        Validator::make(['request_id' => $request_id], [
            'request_id' => ['required', 'string', 'max:64', 'regex:/\AREQ-[0-9]{4}-[A-Z0-9]+\z/'],
        ])->validate();
        // Pembatasan wilayah sama dengan detail permohonan.
        $application = Application::query()->forUser($user)->select(['id', 'request_id'])->where('request_id', $request_id)->firstOrFail();
        $attachment = DB::table('application_attachments')->where('application_id', $application->id)->where('id', (int) $id)->first();
        if (! $attachment) {
            return response()->json(['message' => 'Lampiran tidak ditemukan.'], 404)->header('Cache-Control', 'private, no-store');
        }
        if ($attachment->purged_at !== null || $attachment->path === null) {
            return response()->json(['message' => 'Lampiran sudah dihapus sesuai masa simpan data.'], 410)->header('Cache-Control', 'private, no-store');
        }
        $contents = AttachmentStore::contents($attachment);
        // Fail closed: isi tidak dikirim bila pencatatan akses gagal.
        DB::table('audit_logs')->insert([
            'user_id' => $user->id, 'action' => 'attachment.viewed', 'subject_type' => 'attachment',
            'subject_id' => $attachment->id, 'created_at' => now(),
        ]);
        $name = $application->request_id.'-'.$attachment->kind.'.'.AttachmentStore::extension($attachment->stored_mime);
        $disposition = str_starts_with($attachment->stored_mime, 'image/') ? 'inline' : 'attachment';

        return response($contents, 200, [
            'Content-Type' => $attachment->stored_mime,
            'Content-Disposition' => $disposition.'; filename="'.$name.'"',
            'Content-Length' => (string) strlen($contents),
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
