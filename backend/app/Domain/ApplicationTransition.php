<?php

namespace App\Domain;

use App\Models\Application;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Satu-satunya jalur transisi status manual: panel petugas (StaffController::update) dan persetujuan kepala desa
 * lewat email (ApprovalController::decide) memanggil fungsi ini, sehingga nomor surat, persetujuan surat, PDF,
 * pembatalan nomor, riwayat, dan notifikasi selalu sama. Aturan alur/wewenang tetap di ApplicationStatus.
 */
final class ApplicationTransition
{
    /**
     * @param  'email'|null  $via  asal perubahan untuk riwayat; null = panel
     *
     * @throws TransitionRejected
     */
    public static function apply(Application $application, string $to, User $user, ?string $note, ?string $via = null): Application
    {
        $note = blank($note) ? null : trim($note);
        $issuedAt = now();
        $result = DB::transaction(function () use ($application, $to, $user, $note, $via, $issuedAt) {
            LetterNumber::acquireWriteLock($issuedAt->year);
            // Dibaca ulang dengan kunci agar klien/tautan basi tidak memindahkan status yang sudah berubah.
            $fresh = Application::whereKey($application->getKey())->lockForUpdate()->firstOrFail();
            if (! $fresh->isInTerritory($user)) throw new TransitionRejected(403, 'Akses ditolak.');
            $from = $fresh->status;
            $type = LetterType::from($fresh->jenis_surat);
            if (! ApplicationStatus::isTransition($from, $to, $type)) throw new TransitionRejected(422, 'Transisi status tidak valid.');
            if (! ApplicationStatus::canTransition($from, $to, $user->role, $type)) throw new TransitionRejected(403, 'Peran Anda tidak berwenang melakukan perubahan status ini.');
            if (ApplicationStatus::requiresNote($to) && $note === null) throw new TransitionRejected(422, 'Catatan wajib diisi.', ['catatan' => ['Catatan wajib diisi.']]);
            if ($from === 'PROCESSING' && $to === 'WAITING_APPROVAL') LetterNumber::issue($fresh, $user, $issuedAt);
            if ($from === 'WAITING_APPROVAL' && in_array($to, ['REJECTED', 'NEED_REVISION'], true)) LetterNumber::void($fresh, $note);
            // Siapa dan kapan Kepala Desa menyetujui, beserta kode verifikasi QR.
            if ($to === 'APPROVED') Letter::approve($fresh, $user);
            $fresh->update(['status' => $to, 'catatan' => $note]);
            $eventId = DB::table('application_events')->insertGetId([
                'application_id' => $fresh->id, 'user_id' => $user->id, 'from_status' => $from, 'to_status' => $to,
                'note' => $note === null ? null : Crypt::encryptString($note), 'via' => $via, 'created_at' => now(),
            ]);
            ApplicationStatusChanged::dispatch($fresh->id, $from, $to, $eventId);

            return $fresh;
        }, 3);
        if ($result->status === 'APPROVED') {
            // Setelah commit terluar (jalur email membungkus transisi dalam transaksinya sendiri).
            // Persetujuan sudah tersimpan; bila PDF gagal dibuat, unduhan pertama akan mencoba lagi.
            DB::afterCommit(function () use ($result) {
                try { Letter::generate($result); } catch (\Throwable $e) { report($e); }
            });
        }

        return $result;
    }
}
