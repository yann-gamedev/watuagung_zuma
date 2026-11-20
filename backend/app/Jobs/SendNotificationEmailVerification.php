<?php

namespace App\Jobs;

use App\Mail\NotificationEmailVerificationMail;
use App\Models\User;
use App\Support\ApplicantEmail;
use App\Support\NotificationEmails;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/** Tautan verifikasi dibuat di dalam job (24 jam sejak job berjalan), bukan disimpan di payload antrean. */
class SendNotificationEmailVerification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(public readonly int $userId) {}

    public function handle(): void
    {
        $user = User::find($this->userId);
        if (! $user || blank($user->notification_email) || $user->notification_email_verified_at !== null) return;
        try {
            Mail::to($user->notification_email)->send(new NotificationEmailVerificationMail($user->name, NotificationEmails::verifyUrl($user)));
        } catch (\Throwable $e) {
            Log::warning('Email verifikasi notifikasi gagal dikirim.', ['user_id' => $user->id, 'email' => ApplicantEmail::mask($user->notification_email), 'error' => $e::class]);
            if ($this->job && $this->job->getConnectionName() !== 'sync' && $this->attempts() < $this->tries) throw $e;
        }
    }
}
