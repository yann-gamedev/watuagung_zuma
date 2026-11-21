<?php

namespace App\Http\Controllers\Api;

use App\Domain\ApplicationTransition;
use App\Domain\Letter;
use App\Domain\LetterType;
use App\Domain\TransitionRejected;
use App\Http\Controllers\Controller;
use App\Jobs\SendPinLockedEmail;
use App\Support\ApplicantEmail;
use App\Support\ApprovalLinks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

/**
 * Persetujuan kepala desa lewat tautan email (E3). Publik tanpa token Sanctum; tautan + PIN menggantikan login.
 * Semua endpoint POST (token di body, tidak pernah di URL/access log). Pratinjau dan draf tidak mengubah status;
 * hanya decide dengan PIN benar yang menjalankan ApplicationTransition (jalur yang sama dengan panel).
 * Lampiran KTP/KK tidak tersedia lewat jalur ini.
 */
class ApprovalController extends Controller
{
    private const GONE = 'Tautan sudah tidak berlaku. Buka panel admin untuk memutuskan permohonan ini.';

    public function preview(Request $request): JsonResponse
    {
        $context = ApprovalLinks::resolve($this->token($request));
        if (! $context) return $this->gone();
        [$link, $application, $head] = $context;
        $this->audit($head->id, 'approval_link.previewed', $application->id);

        return $this->json([
            'request_id' => $application->request_id,
            'jenis_surat' => $application->jenis_surat,
            'jenis_surat_label' => ApplicantEmail::letterTypeName(LetterType::from($application->jenis_surat)),
            'nama' => $application->nama,
            'submitted_at' => Carbon::parse($application->created_at)->toISOString(),
            'verified_by' => ApprovalLinks::verifierName($application),
            'letter_number' => ApprovalLinks::letterNumber($application),
            'head_name' => $head->name,
            'expires_at' => Carbon::parse($link->expires_at)->toISOString(),
            'pin_attempts_left' => ApprovalLinks::MAX_PIN_ATTEMPTS - (int) $link->failed_pin_attempts,
        ]);
    }

    /** Draf PDF (sama dengan pratinjau draf panel), hanya selama tautan berlaku. */
    public function draft(Request $request): Response
    {
        $context = ApprovalLinks::resolve($this->token($request));
        if (! $context) return $this->gone();
        [, $application, $head] = $context;
        $pdf = Letter::render($application, null);
        // Fail closed: catat dulu sebelum isi dikirim.
        $this->audit($head->id, 'letter.draft_viewed', $application->id);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="draf-'.$application->request_id.'.pdf"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function decide(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:100'],
            'pin' => ['required', 'string', 'max:20'],
            'decision' => ['required', 'in:approve,reject'],
            'note' => ['nullable', 'string', 'max:1000', 'required_if:decision,reject'],
        ], [
            'pin.required' => 'PIN wajib diisi.',
            'decision.in' => 'Pilih Setuju atau Tolak.',
            'note.required_if' => 'Alasan penolakan wajib diisi.',
            'note.max' => 'Alasan maksimal 1000 karakter.',
        ]);
        $to = $data['decision'] === 'approve' ? 'APPROVED' : 'REJECTED';

        $written = [];
        $root = DB::transactionLevel() === 0;
        // ponytail: one attempt; retry the request after failure. Restore retries only with commit-failure callback cleanup.
        try {
            $outcome = DB::transaction(function () use ($data, $to, &$written) {
                // Baris tautan dikunci: dua klik bersamaan tidak bisa memakai tautan dua kali atau melewati batas PIN.
                $context = ApprovalLinks::resolve($data['token'], lock: true);
                if (! $context) return ['gone'];
                [$link, $application, $head] = $context;
                if (! Hash::check($data['pin'], $head->approval_pin_hash)) {
                    $attempts = (int) $link->failed_pin_attempts + 1;
                    $locked = $attempts >= ApprovalLinks::MAX_PIN_ATTEMPTS;
                    DB::table('approval_links')->where('id', $link->id)->update(['failed_pin_attempts' => $attempts] + ($locked ? ['locked_at' => now()] : []));
                    $this->audit($head->id, $locked ? 'approval_link.locked' : 'approval_link.pin_failed', $application->id);

                    return $locked ? ['locked', $head->id, $application->request_id] : ['wrong', ApprovalLinks::MAX_PIN_ATTEMPTS - $attempts];
                }
                $result = ApplicationTransition::apply($application, $to, $head, $data['note'] ?? null, via: 'email', written: $written);
                DB::table('approval_links')->where('id', $link->id)->update(['used_at' => now()]);
                $this->audit($head->id, $to === 'APPROVED' ? 'application.approved_via_email' : 'application.rejected_via_email', $application->id);

                return ['ok', $result];
            });
        } catch (TransitionRejected $e) {
            // Aturan alur menolak (mis. akun kehilangan wewenang): tautan tidak terpakai, status tidak berubah.
            return $this->json($e->body(), $e->status);
        } finally {
            if ($root) Letter::discardUnreferenced($written);
        }

        return match ($outcome[0]) {
            'gone' => $this->gone(),
            'wrong' => $this->json([
                'message' => "PIN salah. Sisa {$outcome[1]} percobaan.",
                'errors' => ['pin' => ["PIN salah. Sisa {$outcome[1]} percobaan."]],
                'pin_attempts_left' => $outcome[1],
            ], 422),
            'locked' => $this->lockedResponse($outcome[1], $outcome[2]),
            'ok' => $this->json([
                'success' => true,
                'request_id' => $outcome[1]->request_id,
                'status' => $outcome[1]->status,
                'letter_number' => $outcome[1]->status === 'READY_FOR_PICKUP' ? ApprovalLinks::letterNumber($outcome[1]) : null,
                'message' => $outcome[1]->status === 'READY_FOR_PICKUP' ? 'Permohonan disetujui.' : 'Permohonan ditolak.',
            ]),
        };
    }

    private function lockedResponse(int $headId, string $requestId): JsonResponse
    {
        SendPinLockedEmail::dispatch($headId, $requestId);

        return $this->json(['message' => 'PIN salah 5 kali. Tautan dikunci; putuskan permohonan ini lewat panel admin.', 'pin_attempts_left' => 0], 423);
    }

    private function token(Request $request): string
    {
        return (string) $request->validate(['token' => ['required', 'string', 'max:100']])['token'];
    }

    private function gone(): JsonResponse
    {
        return $this->json(['message' => self::GONE], 410);
    }

    private function json(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->header('Cache-Control', 'private, no-store');
    }

    private function audit(int $userId, string $action, int $applicationId): void
    {
        DB::table('audit_logs')->insert(['user_id' => $userId, 'action' => $action, 'subject_type' => 'application', 'subject_id' => $applicationId, 'created_at' => now()]);
    }
}
