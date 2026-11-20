<?php

namespace App\Jobs;

use App\Mail\PinLockedMail;
use App\Models\User;
use App\Support\ApplicantEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/** Payload hanya ID; alamat email dibaca dari kolom terenkripsi saat job berjalan. */
class SendPinLockedEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(public readonly int $userId, public readonly string $requestId) {}

    public function handle(): void
    {
        $user = User::find($this->userId);
        if (! $user || blank($user->notification_email) || $user->notification_email_verified_at === null) return;
        try {
            Mail::to($user->notification_email)->send(new PinLockedMail($this->requestId));
        } catch (\Throwable $e) {
            Log::warning('Email PIN terkunci gagal dikirim.', ['request_id' => $this->requestId, 'user_id' => $user->id, 'email' => ApplicantEmail::mask($user->notification_email), 'error' => $e::class]);
            if ($this->job && $this->job->getConnectionName() !== 'sync' && $this->attempts() < $this->tries) throw $e;
        }
    }
}
