<?php

namespace App\Listeners;

use App\Domain\ApplicationStatusChanged;
use App\Domain\LetterType;
use App\Mail\HeadApprovalMail;
use App\Models\Application;
use App\Models\User;
use App\Support\ApplicantEmail;
use App\Support\ApprovalLinks;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Saat permohonan masuk WAITING_APPROVAL: satu tautan + satu email per kepala desa aktif yang email
 * notifikasinya terverifikasi DAN sudah punya PIN. Token dibuat di dalam job, sehingga token mentah tidak pernah
 * tersimpan di tabel jobs. Satu percobaan saja: percobaan ulang akan mengirim tautan ganda.
 */
class SendHeadApprovalLinks implements ShouldQueue
{
    use InteractsWithQueue;

    public int $tries = 1;

    public function shouldQueue(ApplicationStatusChanged $event): bool
    {
        return $event->toStatus === 'WAITING_APPROVAL' && self::eligibleHeads()->isNotEmpty();
    }

    public function handle(ApplicationStatusChanged $event): void
    {
        $application = Application::find($event->applicationId);
        // Status bisa sudah berubah lagi sebelum job berjalan.
        if (! $application || $application->status !== 'WAITING_APPROVAL') return;
        $type = ApplicantEmail::letterTypeName(LetterType::from($application->jenis_surat));
        $verifier = ApprovalLinks::verifierName($application);
        $number = ApprovalLinks::letterNumber($application);
        foreach (self::eligibleHeads() as $head) {
            $token = ApprovalLinks::issue($application, $head);
            try {
                Mail::to($head->notification_email)->send(new HeadApprovalMail(
                    requestId: $application->request_id,
                    letterType: $type,
                    applicantName: $application->nama,
                    submittedAt: ApplicantEmail::indonesianDate(Carbon::parse($application->created_at)),
                    verifierName: $verifier,
                    letterNumber: $number,
                    reviewUrl: ApprovalLinks::url($token),
                    approveUrl: ApprovalLinks::url($token, 'setuju'),
                    rejectUrl: ApprovalLinks::url($token, 'tolak'),
                    expiresAt: ApplicantEmail::indonesianDate(now()->addHours(ApprovalLinks::TTL_HOURS), true),
                ));
            } catch (\Throwable $e) {
                // Token sudah tidak dapat dipulihkan; tautan tak terkirim tidak berbahaya dan kedaluwarsa sendiri.
                Log::warning('Email persetujuan kepala desa gagal dikirim.', [
                    'request_id' => $application->request_id, 'user_id' => $head->id,
                    'email' => ApplicantEmail::mask($head->notification_email), 'error' => $e::class,
                ]);
            }
        }
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    private static function eligibleHeads()
    {
        return User::query()->where('role', 'village_head')->where('is_active', true)
            ->whereNotNull('notification_email_verified_at')->whereNotNull('approval_pin_hash')->get()
            ->filter(fn (User $user) => $user->canApproveByEmail())->values();
    }
}
