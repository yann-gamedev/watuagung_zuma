<?php
namespace App\Http\Controllers\Api;
use App\Domain\AccessCode;
use App\Domain\LetterSubmission;
use App\Domain\LetterType;
use App\Http\Controllers\Controller;
use App\Models\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
class ApplicationController extends Controller {
    public function store(Request $request): JsonResponse {
        // Aturan per jenis surat ada di LetterSubmission/LetterType, bukan di controller.
        $data = LetterSubmission::validate($request->all());
        // Teks asli warga disimpan terpisah agar sunting petugas tetap dapat dibandingkan.
        if (isset($data['isi_keterangan'])) $data['isi_keterangan_awal'] = $data['isi_keterangan'];
        $secret = AccessCode::generate();
        $application = DB::transaction(function () use ($data, $secret) {
            $application = Application::create($data + [
                'request_id'=>'REQ-'.now()->year.'-'.Str::upper((string) Str::ulid()),
                'lookup_secret_hash'=>AccessCode::hash($secret), 'status'=>'SUBMITTED',
            ]);
            DB::table('application_events')->insert(['application_id'=>$application->id,'to_status'=>'SUBMITTED','created_at'=>now()]);
            return $application;
        });
        return response()->json(['success'=>true,'request_id'=>$application->request_id,'status'=>$application->status,'jenis_surat'=>$application->jenis_surat,'requires_neighborhood_approval'=>LetterType::from($application->jenis_surat)->requiresNeighborhoodApproval(),'lookup_secret'=>$secret], 201);
    }
    public function status(Request $request): JsonResponse {
        $data = $request->validate(['request_id'=>['required','string','max:64'],'lookup_secret'=>['required','string','max:128']]);
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
        return response()->json(['success'=>true,'request_id'=>$application->request_id,'jenis_surat'=>$application->jenis_surat,'requires_neighborhood_approval'=>LetterType::from($application->jenis_surat)->requiresNeighborhoodApproval(),'status'=>$application->status,'catatan'=>$note,'letter_number'=>$letterNumber]);
    }
}
