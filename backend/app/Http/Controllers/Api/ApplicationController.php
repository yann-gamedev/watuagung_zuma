<?php
namespace App\Http\Controllers\Api;
use App\Domain\AccessCode;
use App\Domain\AttachmentKind;
use App\Domain\LetterSubmission;
use App\Domain\LetterType;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Support\AttachmentStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
class ApplicationController extends Controller {
    public function store(Request $request): JsonResponse {
        // Aturan per jenis surat ada di LetterSubmission/LetterType, bukan di controller.
        $type = is_string($request->input('jenis_surat')) ? LetterType::tryFrom($request->input('jenis_surat')) : null;
        $kinds = $type?->isOffered() ? $type->requiredAttachments() : AttachmentKind::cases();
        // Kesalahan formulir dan lampiran dikembalikan bersama supaya warga cukup memperbaiki sekali.
        $errors = AttachmentStore::errors($request->all()['lampiran'] ?? null, $kinds);
        try {
            $data = LetterSubmission::validate($request->except('lampiran'));
        } catch (ValidationException $e) {
            $errors = $e->errors() + $errors;
        }
        if ($errors !== []) throw ValidationException::withMessages($errors);
        // Teks asli warga disimpan terpisah agar sunting petugas tetap dapat dibandingkan.
        if (isset($data['isi_keterangan'])) $data['isi_keterangan_awal'] = $data['isi_keterangan'];
        $secret = AccessCode::generate();
        $files = $request->file('lampiran');
        $written = [];
        try {
            $application = DB::transaction(function () use ($data, $secret, $files, $kinds, &$written) {
                $application = Application::create($data + [
                    'request_id'=>'REQ-'.now()->year.'-'.Str::upper((string) Str::ulid()),
                    'lookup_secret_hash'=>AccessCode::hash($secret), 'status'=>'SUBMITTED',
                ]);
                DB::table('application_events')->insert(['application_id'=>$application->id,'to_status'=>'SUBMITTED','created_at'=>now()]);
                AttachmentStore::storeAll($application, $files, $kinds, 'applicant', $written);
                return $application;
            });
        } catch (\Throwable $e) {
            // Transaksi sudah dibatalkan; file yang terlanjur tertulis tidak boleh tertinggal tanpa baris.
            AttachmentStore::discard($written);
            throw $e;
        }
        return response()->json(['success'=>true,'request_id'=>$application->request_id,'status'=>$application->status,'jenis_surat'=>$application->jenis_surat,'requires_neighborhood_approval'=>LetterType::from($application->jenis_surat)->requiresNeighborhoodApproval(),'lampiran'=>AttachmentStore::receivedKinds($application),'lookup_secret'=>$secret], 201);
    }
    public function status(Request $request): JsonResponse {
        $application = $this->authenticate($request);
        if ($application instanceof JsonResponse) return $application;
        $note = $application->catatan;
        if ($application->status === 'REJECTED' && LetterType::from($application->jenis_surat)->requiresNeighborhoodApproval()) {
            // The originating status records the decision stage even if the account role changes or is deleted.
            $event = DB::table('application_events')->where('application_id', $application->id)
                ->where('to_status', 'REJECTED')->whereNull('action')->orderByDesc('id')->first();
            $head = match ($event?->from_status) {
                'SUBMITTED' => 'RT',
                'RT_APPROVED' => 'RW',
                default => null,
            };
            if ($head !== null) $note = 'Ditolak oleh Ketua '.$head.': '.rtrim($event->note ?? $note ?? '', '. ').'. Silakan ajukan ulang setelah data diperbaiki.';
        }
        $letterNumber = in_array($application->status, ['APPROVED', 'READY_FOR_PICKUP', 'COMPLETED'], true)
            ? DB::table('letter_numbers')->where('application_id', $application->id)->where('status', 'issued')->orderByDesc('id')->value('number')
            : null;
        return response()->json(['success'=>true,'request_id'=>$application->request_id,'jenis_surat'=>$application->jenis_surat,'requires_neighborhood_approval'=>LetterType::from($application->jenis_surat)->requiresNeighborhoodApproval(),'status'=>$application->status,'catatan'=>$note,'letter_number'=>$letterNumber,'lampiran'=>AttachmentStore::receivedKinds($application)]);
    }

    /**
     * Warga mengganti satu atau lebih lampiran saat permohonan berstatus NEED_REVISION.
     * Kode akses memakai kunci percobaan yang sama dengan cek status.
     */
    public function replaceAttachments(Request $request): JsonResponse {
        $application = $this->authenticate($request);
        if ($application instanceof JsonResponse) return $application;
        if ($application->status !== 'NEED_REVISION') return $this->notRevisable();
        $allowed = LetterType::from($application->jenis_surat)->requiredAttachments();
        $files = $request->all()['lampiran'] ?? null;
        // Hanya jenis yang dikirim yang diperiksa; jenis lain tetap memakai file lama.
        $present = array_values(array_filter($allowed, fn (AttachmentKind $kind) => is_array($files) && array_key_exists($kind->value, $files)));
        $errors = AttachmentStore::errors($files, $allowed, $present);
        if ($present === [] && ! isset($errors['lampiran'])) $errors['lampiran'] = ['Pilih minimal satu lampiran yang akan diganti.'];
        if ($errors !== []) throw ValidationException::withMessages($errors);
        $uploads = $request->file('lampiran');
        $written = [];
        try {
            $old = DB::transaction(function () use ($application, $uploads, $present, &$written) {
                // Kunci baris: petugas bisa mengubah status di antara pemeriksaan dan penyimpanan.
                $locked = Application::whereKey($application->id)->lockForUpdate()->firstOrFail();
                if ($locked->status !== 'NEED_REVISION') return null;
                $old = AttachmentStore::replace($locked, $uploads, $present, 'applicant', $written);
                DB::table('application_events')->insert([
                    'application_id'=>$locked->id, 'action'=>'ATTACHMENTS_UPDATED', 'from_status'=>$locked->status, 'to_status'=>$locked->status,
                    'note'=>'Lampiran diperbarui: '.implode(', ', array_map(fn (AttachmentKind $kind) => $kind->label(), $present)),
                    'created_at'=>now(),
                ]);
                return $old;
            });
        } catch (\Throwable $e) {
            // Baris lama tetap menunjuk file lama; hanya file baru yang terlanjur tertulis yang dibuang.
            AttachmentStore::discard($written);
            throw $e;
        }
        if ($old === null) {
            AttachmentStore::discard($written);
            return $this->notRevisable();
        }
        // Setelah commit: file lama tidak lagi dirujuk. Gagal hapus hanya menyisakan file terenkripsi yatim.
        AttachmentStore::deleteFiles($old);
        return response()->json(['success'=>true,'request_id'=>$application->request_id,'status'=>'NEED_REVISION','lampiran'=>AttachmentStore::receivedKinds($application)]);
    }

    /** Nomor pengajuan + kode akses; 5 kode salah per nomor mengunci 15 menit (dipakai bersama semua endpoint warga). */
    private function authenticate(Request $request): Application|JsonResponse {
        $data = Validator::make(
            ['request_id'=>$request->input('request_id'), 'lookup_secret'=>$request->input('lookup_secret')],
            ['request_id'=>['required','string','max:64'],'lookup_secret'=>['required','string','max:128']],
        )->validate();
        // Kunci per nomor pengajuan: batas per IP saja bisa diakali dengan banyak perangkat.
        $key = 'lookup:'.$data['request_id'];
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['success'=>false,'message'=>'Terlalu banyak percobaan kode akses. Coba lagi dalam 15 menit.'], 429);
        }
        $application = Application::where('request_id', $data['request_id'])->first();
        if (! $application || ! AccessCode::matches($data['lookup_secret'], $application->lookup_secret_hash)) {
            RateLimiter::hit($key, 900);
            return response()->json(['success'=>false,'message'=>'Permohonan tidak ditemukan atau kode akses tidak valid.'], 404);
        }
        RateLimiter::clear($key);
        return $application;
    }

    private function notRevisable(): JsonResponse {
        return response()->json(['success'=>false,'message'=>'Lampiran hanya dapat diganti saat permohonan berstatus perlu perbaikan.'], 422);
    }
}
