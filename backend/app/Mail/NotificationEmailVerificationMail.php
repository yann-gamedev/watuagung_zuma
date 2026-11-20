<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Verifikasi email notifikasi akun petugas; tautan bertanda tangan 24 jam ke halaman frontend (E4). */
class NotificationEmailVerificationMail extends Mailable
{
    public function __construct(public readonly string $name, public readonly string $verifyUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Konfirmasi email notifikasi panel desa');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.notification-email-verification');
    }
}
