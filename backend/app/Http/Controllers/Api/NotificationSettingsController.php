<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendNotificationEmailVerification;
use App\Models\User;
use App\Support\ApprovalLinks;
use App\Support\NotificationEmails;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * E3: email notifikasi dan PIN persetujuan milik akun yang sedang login. Semua peran panel boleh menyimpan email;
 * hanya village_head yang punya PIN dan menerima tautan persetujuan.
 */
class NotificationSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canAccessPanel()) return $this->forbidden();

        return $this->settings($user);
    }

    public function updateEmail(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canAccessPanel()) return $this->forbidden();
        $data = $request->validate(
            ['email' => ['nullable', 'string', 'max:120', 'email:rfc']],
            ['email.email' => 'Format email tidak valid. Contoh: nama@contoh.com.', 'email.max' => 'Email maksimal 120 karakter.'],
        );
        $email = blank($data['email'] ?? null) ? null : trim($data['email']);
        $same = $email !== null && filled($user->notification_email)
            && NotificationEmails::fingerprint($email) === NotificationEmails::fingerprint($user->notification_email);
        if (! $same) {
            DB::transaction(function () use ($user, $email) {
                $user->forceFill(['notification_email' => $email, 'notification_email_verified_at' => null])->save();
                // Alamat lama tidak boleh lagi memegang tautan persetujuan.
                ApprovalLinks::revokeOpenForUser($user->id);
                $this->audit($user, 'account.notification_email_updated');
            });
            if ($email !== null) SendNotificationEmailVerification::dispatch($user->id)->afterCommit();
        } elseif ($user->notification_email_verified_at === null) {
            // Kirim ulang tautan verifikasi untuk alamat yang sama.
            SendNotificationEmailVerification::dispatch($user->id);
        }

        return $this->settings($user->fresh());
    }

    /** Publik, tanpa login: URL bertanda tangan 24 jam dari email verifikasi (diteruskan halaman /verifikasi-email/). */
    public function verify(Request $request): JsonResponse
    {
        if (! $request->hasValidSignature(false)) {
            return response()->json(['success' => false, 'message' => 'Tautan verifikasi tidak valid atau sudah kedaluwarsa. Minta tautan baru dari panel.'], 403);
        }
        $user = User::find((int) $request->query('user'));
        if (! $user || blank($user->notification_email)
            || ! hash_equals(NotificationEmails::fingerprint($user->notification_email), (string) $request->query('email'))) {
            return response()->json(['success' => false, 'message' => 'Email notifikasi sudah diganti. Gunakan tautan dari email terbaru.'], 410);
        }
        if ($user->notification_email_verified_at === null) {
            DB::transaction(function () use ($user) {
                $user->forceFill(['notification_email_verified_at' => now()])->save();
                $this->audit($user, 'account.notification_email_verified');
            });
        }

        return response()->json(['success' => true, 'message' => 'Email notifikasi terverifikasi.']);
    }

    public function updatePin(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->canAccessPanel() || $user->role !== 'village_head') {
            return response()->json(['message' => 'PIN persetujuan hanya untuk Kepala Desa.'], 403);
        }
        $data = $request->validate([
            'pin' => ['required', 'string', 'regex:/\A[0-9]{6}\z/', 'confirmed'],
            'password' => ['required', 'string'],
        ], [
            'pin.required' => 'PIN wajib diisi.',
            'pin.regex' => 'PIN harus 6 digit angka.',
            'pin.confirmed' => 'Konfirmasi PIN tidak sama.',
            'password.required' => 'Kata sandi akun wajib diisi.',
        ]);
        if (NotificationEmails::isWeakPin($data['pin'])) {
            throw ValidationException::withMessages(['pin' => 'PIN terlalu mudah ditebak. Hindari angka sama atau berurutan.']);
        }
        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => 'Kata sandi akun tidak cocok.']);
        }
        DB::transaction(function () use ($user, $data) {
            $user->forceFill(['approval_pin_hash' => Hash::make($data['pin']), 'approval_pin_set_at' => now()])->save();
            $this->audit($user, 'account.approval_pin_set');
        });

        return $this->settings($user->fresh());
    }

    private function settings(User $user): JsonResponse
    {
        return response()->json([
            'notification_email' => $user->notification_email,
            'notification_email_verified' => $user->notification_email_verified_at !== null,
            'approval_by_email_available' => $user->role === 'village_head',
            'approval_pin_set' => $user->approval_pin_hash !== null,
            'approval_pin_set_at' => $user->approval_pin_set_at?->toISOString(),
            'approval_by_email_active' => $user->canApproveByEmail(),
        ])->header('Cache-Control', 'private, no-store');
    }

    private function audit(User $user, string $action): void
    {
        DB::table('audit_logs')->insert(['user_id' => $user->id, 'action' => $action, 'subject_type' => 'user', 'subject_id' => $user->id, 'created_at' => now()]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Akses ditolak.'], 403)->header('Cache-Control', 'private, no-store');
    }
}
