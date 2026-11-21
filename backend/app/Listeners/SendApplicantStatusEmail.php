<?php

namespace App\Listeners;

use App\Domain\ApplicationStatus;
use App\Domain\ApplicationStatusChanged;
use App\Domain\Letter;
use App\Domain\LetterType;
use App\Mail\ApplicantStatusMail;
use App\Models\Application;
use App\Support\ApplicantEmail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Kirim email status ke pemohon bila ada email, ada persetujuan, dan belum berhenti berlangganan.
 * Kegagalan kirim tidak pernah memengaruhi status: status sudah tersimpan sebelum event dikirim (after commit).
 */
class SendApplicantStatusEmail implements ShouldQueue
{
    use InteractsWithQueue;

    public int $tries = 3;

    /** @return list<int> */
    public function backoff(): array
    {
        return [60, 300];
    }

    /** Tanpa email/persetujuan, tidak ada job yang masuk antrean. */
    public function shouldQueue(ApplicationStatusChanged $event): bool
    {
        $application = Application::find($event->applicationId);

        return $application !== null && ApplicantEmail::canNotify($application);
    }

    public function handle(ApplicationStatusChanged $event): void
    {
        // Dibaca ulang: pemohon bisa berhenti berlangganan atau data dihapus retensi sejak job dibuat.
        $application = Application::find($event->applicationId);
        if (! $application || ! ApplicantEmail::canNotify($application)) return;
        $status = ApplicationStatus::from($event->toStatus);

        try {
            Mail::to($application->email)->send(new ApplicantStatusMail(
                requestId: $application->request_id,
                letterType: ApplicantEmail::letterTypeName(LetterType::from($application->jenis_surat)),
                statusLabel: $status->citizenLabel(),
                statusLine: ApplicantEmail::statusLine($status, $status === ApplicationStatus::ReadyForPickup ? Letter::downloadUntil(Letter::find($application)) : null),
                note: in_array($status, [ApplicationStatus::NeedRevision, ApplicationStatus::Rejected], true) ? $this->note($event->eventId) : null,
                statusUrl: ApplicantEmail::statusUrl($application->request_id),
                unsubscribeUrl: ApplicantEmail::unsubscribeUrl($application->request_id),
            ));
        } catch (\Throwable $e) {
            // Alamat disamarkan; isi email dan catatan tidak dicatat.
            Log::warning('Email status pemohon gagal dikirim.', [
                'request_id' => $application->request_id,
                'to_status' => $event->toStatus,
                'email' => ApplicantEmail::mask($application->email),
                'attempt' => $this->attempts(),
                'error' => $e::class,
            ]);
            // Antrean asli mencoba lagi; koneksi sync (lokal/tes) tidak melempar agar respons petugas tetap sukses.
            if ($this->job && $this->job->getConnectionName() !== 'sync' && $this->attempts() < $this->tries) throw $e;
        }
    }

    private function note(int $eventId): ?string
    {
        $note = DB::table('application_events')->where('id', $eventId)->value('note');
        if ($note === null) return null;
        try {
            return Crypt::decryptString($note);
        } catch (\Illuminate\Contracts\Encryption\DecryptException) {
            // Catatan tak terbaca tidak boleh menggagalkan email; warga tetap diarahkan ke halaman cek status.
            return null;
        }
    }
}
